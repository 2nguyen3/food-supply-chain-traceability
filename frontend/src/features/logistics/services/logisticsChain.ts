import { Contract, getAddress, isAddress, JsonRpcProvider, type EventLog } from 'ethers'
import { config } from '../../../config/env'
import abiFile from '../../../contracts/FoodTraceability.json'
import type { Lifecycle } from '../../../domain/types'
import { sha256Hex, toBytes32 } from '../../../lib/hash'
import { argsOf, makeLogQuery } from '../../../services/chainLogs'
import { mapChainBounded } from '../../../services/chainConcurrency'
import { roleHash } from '../../../services/roles'
import { sendTransaction, type TxProgress } from '../../../services/tx'
import { ipfsFileUrl } from '../../public/services/publicChainReader'

const LIFECYCLES: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']

export const TEMP_MIN_C = 8
export const TEMP_MAX_C = 15

export class LogisticsChainError extends Error {}

function openContract() {
  if (!config.publicRpcUrl || !config.contractAddress || !isAddress(config.contractAddress))
    throw new LogisticsChainError('Thiếu cấu hình VITE_PUBLIC_RPC_URL hoặc VITE_CONTRACT_ADDRESS.')
  const provider = new JsonRpcProvider(config.publicRpcUrl, config.chainId, { staticNetwork: true, batchMaxCount: 1 })
  const contract = new Contract(config.contractAddress, abiFile.abi, provider)
  return { provider, contract }
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

const ROLE_NAMES = [
  ['logistics', 'Logistics'],
  ['retailer', 'Retailer'],
  ['farmer', 'Farmer'],
  ['admin', 'Admin'],
] as const

function makeLabeler(contract: Contract, self: string) {
  const cache = new Map<string, string>()
  return async (address: string): Promise<string> => {
    if (address.toLowerCase() === self.toLowerCase()) return 'Bạn'
    if (!cache.has(address)) {
      let label = shortAddress(address)
      for (const [role, display] of ROLE_NAMES) {
        if (await contract.hasRole(roleHash(role), address)) {
          label = `${display} · ${shortAddress(address)}`
          break
        }
      }
      cache.set(address, label)
    }
    return cache.get(address)!
  }
}

export interface TransitReadingItem {
  readingId: string
  tempC: number
  tempCenti: number
  outOfRange: boolean
  observedAt: string
  blockTime: string
  location: string
  txHash: string
}

export interface LogisticsPendingInfo {
  requestId: string
  from: `0x${string}`
  fromLabel: string
  to: `0x${string}`
  toLabel: string
  requestedAt: string
}

export interface LogisticsBatch {
  code: string
  tokenId: string
  farmId: string
  farmLocation: string
  harvestGroupId: string
  quantityKg: number
  harvestDate: string
  expiryDate: string
  expired: boolean
  lifecycle: Lifecycle
  recalled: boolean
  owner: `0x${string}`
  ownedByMe: boolean
  ownerLabel: string
  metadataCid: string
  metadataHash: `0x${string}`
  certificateHash: `0x${string}`
  imageHash: `0x${string}`
  readings: TransitReadingItem[]
  hasTempAlert: boolean
  pendingIncoming?: LogisticsPendingInfo
  pendingOutgoing?: LogisticsPendingInfo
}

export type TransferHistoryStatus = 'accepted' | 'rejected' | 'cancelled'

export interface LogisticsTransferRecord {
  requestId: string
  tokenId: string
  batchCode: string
  from: `0x${string}`
  fromLabel: string
  to: `0x${string}`
  toLabel: string
  status: TransferHistoryStatus
  requestedAt: string
  closedAt: string
}

export interface LogisticsSnapshot {
  address: `0x${string}`
  logisticsLabel: string
  ownedBatches: LogisticsBatch[]
  incomingPending: LogisticsBatch[]
  outgoingPending: LogisticsBatch[]
  incomingHistory: LogisticsTransferRecord[]
  outgoingHistory: LogisticsTransferRecord[]
  allRelevantBatches: Map<string, LogisticsBatch>
}

export async function readLogisticsSnapshot(
  address: `0x${string}`,
  signal?: AbortSignal,
): Promise<LogisticsSnapshot> {
  const { provider, contract } = openContract()
  try {
    const latest = await provider.getBlockNumber()
    const logs = makeLogQuery(contract, config.deployBlock, latest, signal)
    const label = makeLabeler(contract, address)

    const blockTimes = new Map<number, string>()
    const timeOf = async (blockNumber: number) => {
      if (!blockTimes.has(blockNumber)) {
        const block = await provider.getBlock(blockNumber)
        blockTimes.set(blockNumber, new Date((block?.timestamp ?? 0) * 1000).toISOString())
      }
      return blockTimes.get(blockNumber)!
    }

    const createdLogs = await logs('BatchCreated')
    const metadataCidOf = new Map<string, string>()
    for (const log of createdLogs) {
      const a = argsOf(log)
      metadataCidOf.set((a.tokenId as bigint).toString(), a.metadataCID as string)
    }

    const requestedLogs = await logs('TransferRequested')
    const requestTimeOf = new Map<string, string>()
    for (const log of requestedLogs) {
      const a = argsOf(log)
      requestTimeOf.set(
        `${a.tokenId}:${a.requestId}`,
        await timeOf((log as EventLog).blockNumber),
      )
    }

    const transitLogs = await logs('TransitRecorded')
    const readingsByToken = new Map<string, TransitReadingItem[]>()
    for (const log of transitLogs) {
      const a = argsOf(log)
      const tokenId = (a.tokenId as bigint).toString()
      const tempCenti = Number(a.tempCenti)
      const tempC = tempCenti / 100
      const item: TransitReadingItem = {
        readingId: (a.readingId as bigint).toString(),
        tempC,
        tempCenti,
        outOfRange: tempC < TEMP_MIN_C || tempC > TEMP_MAX_C,
        observedAt: new Date(Number(a.observedAt) * 1000).toISOString(),
        blockTime: await timeOf((log as EventLog).blockNumber),
        location: a.location as string,
        txHash: log.transactionHash,
      }
      const list = readingsByToken.get(tokenId) ?? []
      list.push(item)
      readingsByToken.set(tokenId, list)
    }
    for (const list of readingsByToken.values()) {
      list.sort((a, b) => Number(a.readingId) - Number(b.readingId))
    }

    const ownedBatches: LogisticsBatch[] = []
    const incomingPending: LogisticsBatch[] = []
    const outgoingPending: LogisticsBatch[] = []
    const allRelevantBatches = new Map<string, LogisticsBatch>()
    const codeOf = new Map<string, string>()

    await mapChainBounded(
      createdLogs,
      async (log) => {
        const a = argsOf(log)
        const tokenId = a.tokenId as bigint
        const tokenIdStr = tokenId.toString()
        const [info, owner, pending, chainExpired] = await Promise.all([
          contract.getBatch(tokenId),
          contract.ownerOf(tokenId) as Promise<string>,
          contract.getPendingTransfer(tokenId),
          contract.isExpired(tokenId),
        ])
        codeOf.set(tokenIdStr, info.batchCode as string)

        const ownerAddress = getAddress(owner) as `0x${string}`
        const ownedByMe = ownerAddress.toLowerCase() === address.toLowerCase()
        const isIncomingToMe =
          Boolean(pending.active) &&
          (pending.to as string).toLowerCase() === address.toLowerCase()
        const isOutgoingFromMe =
          Boolean(pending.active) &&
          (pending.from as string).toLowerCase() === address.toLowerCase()

        if (!ownedByMe && !isIncomingToMe && !isOutgoingFromMe) return

        const readings = readingsByToken.get(tokenIdStr) ?? []
        const reqIdStr = pending.active ? (pending.requestId as bigint).toString() : ''
        const pendingInfo: LogisticsPendingInfo | undefined = pending.active
          ? {
              requestId: reqIdStr,
              from: getAddress(pending.from) as `0x${string}`,
              fromLabel: await label(pending.from),
              to: getAddress(pending.to) as `0x${string}`,
              toLabel: await label(pending.to),
              requestedAt: requestTimeOf.get(`${tokenIdStr}:${reqIdStr}`) ?? new Date().toISOString(),
            }
          : undefined

        const batch: LogisticsBatch = {
          code: info.batchCode as string,
          tokenId: tokenIdStr,
          farmId: info.farmId as string,
          farmLocation: info.farmLocation as string,
          harvestGroupId: info.harvestGroupId as string,
          quantityKg: Number(info.quantityKg),
          harvestDate: new Date(Number(info.harvestDate) * 1000).toISOString(),
          expiryDate: new Date(Number(info.expiryDate) * 1000).toISOString(),
          expired: Boolean(chainExpired) || Date.now() >= Number(info.expiryDate) * 1000,
          lifecycle: LIFECYCLES[Number(info.lifecycle)] ?? 'Created',
          recalled: Boolean(info.recalled),
          owner: ownerAddress,
          ownedByMe,
          ownerLabel: await label(ownerAddress),
          metadataCid: metadataCidOf.get(tokenIdStr) ?? '',
          metadataHash: info.metadataHash as `0x${string}`,
          certificateHash: info.certificateHash as `0x${string}`,
          imageHash: info.imageHash as `0x${string}`,
          readings,
          hasTempAlert: readings.some((r) => r.outOfRange),
          pendingIncoming: isIncomingToMe ? pendingInfo : undefined,
          pendingOutgoing: isOutgoingFromMe ? pendingInfo : undefined,
        }

        allRelevantBatches.set(batch.code, batch)
        allRelevantBatches.set(batch.code.toUpperCase(), batch)
        allRelevantBatches.set(batch.tokenId, batch)
        if (ownedByMe) ownedBatches.push(batch)
        if (isIncomingToMe) incomingPending.push(batch)
        if (isOutgoingFromMe) outgoingPending.push(batch)
      },
      signal,
    )

    ownedBatches.sort((a, b) => Number(a.tokenId) - Number(b.tokenId))
    incomingPending.sort((a, b) => Number(a.tokenId) - Number(b.tokenId))
    outgoingPending.sort((a, b) => Number(a.tokenId) - Number(b.tokenId))

    const closedEvents: [string, TransferHistoryStatus][] = [
      ['TransferAccepted', 'accepted'],
      ['TransferRejected', 'rejected'],
      ['TransferCancelled', 'cancelled'],
    ]
    const closedMap = new Map<string, { status: TransferHistoryStatus; at: string }>()
    for (const [evName, status] of closedEvents) {
      for (const log of await logs(evName)) {
        const a = argsOf(log)
        closedMap.set(`${a.tokenId}:${a.requestId}`, {
          status,
          at: await timeOf((log as EventLog).blockNumber),
        })
      }
    }

    const incomingHistory: LogisticsTransferRecord[] = []
    const outgoingHistory: LogisticsTransferRecord[] = []
    for (const log of requestedLogs) {
      const a = argsOf(log)
      const tokenIdStr = (a.tokenId as bigint).toString()
      const requestIdStr = (a.requestId as bigint).toString()
      const end = closedMap.get(`${tokenIdStr}:${requestIdStr}`)
      if (!end) continue
      const fromAddr = getAddress(a.from as string) as `0x${string}`
      const toAddr = getAddress(a.to as string) as `0x${string}`
      const record: LogisticsTransferRecord = {
        requestId: requestIdStr,
        tokenId: tokenIdStr,
        batchCode: codeOf.get(tokenIdStr) ?? `#${tokenIdStr}`,
        from: fromAddr,
        fromLabel: await label(fromAddr),
        to: toAddr,
        toLabel: await label(toAddr),
        status: end.status,
        requestedAt: await timeOf((log as EventLog).blockNumber),
        closedAt: end.at,
      }
      if (toAddr.toLowerCase() === address.toLowerCase()) incomingHistory.push(record)
      if (fromAddr.toLowerCase() === address.toLowerCase()) outgoingHistory.push(record)
    }
    incomingHistory.sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))
    outgoingHistory.sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))

    return {
      address,
      logisticsLabel: `Logistics · ${shortAddress(address)}`,
      ownedBatches,
      incomingPending,
      outgoingPending,
      incomingHistory,
      outgoingHistory,
      allRelevantBatches,
    }
  } catch (error) {
    if (error instanceof LogisticsChainError) throw error
    if (signal?.aborted) throw error
    throw new LogisticsChainError('Không đọc được dữ liệu từ blockchain. Kiểm tra mạng và thử lại.')
  } finally {
    provider.destroy()
  }
}

export interface FileHashCheckResult {
  key: 'metadata' | 'certificate' | 'image'
  label: string
  cid: string
  expectedHash: `0x${string}`
  actualHash: `0x${string}` | null
  matched: boolean
  error?: string
}

export async function verifyBatchIpfsFiles(batch: LogisticsBatch): Promise<{
  allMatched: boolean
  files: FileHashCheckResult[]
  metadataJson?: Record<string, unknown>
}> {
  const results: FileHashCheckResult[] = []
  let metadataJson: Record<string, unknown> | undefined
  let certCid = ''
  let imageCid = ''

  try {
    const metaResp = await fetch(ipfsFileUrl(batch.metadataCid), { signal: AbortSignal.timeout(12000) })
    if (!metaResp.ok) throw new Error(`HTTP ${metaResp.status}`)
    const metaBuf = await metaResp.arrayBuffer()
    const actualMeta = toBytes32(await sha256Hex(metaBuf))
    const matchedMeta = actualMeta.toLowerCase() === batch.metadataHash.toLowerCase()
    results.push({
      key: 'metadata',
      label: 'metadata.json',
      cid: batch.metadataCid,
      expectedHash: batch.metadataHash,
      actualHash: actualMeta,
      matched: matchedMeta,
    })
    metadataJson = JSON.parse(new TextDecoder().decode(metaBuf)) as Record<string, unknown>
    const rawCert =
      (metadataJson.certificateURI as string | undefined) ??
      (metadataJson.certificate as string | undefined) ??
      (metadataJson.certificate_cid as string | undefined) ??
      ''
    const rawImg =
      (metadataJson.image as string | undefined) ??
      (metadataJson.image_cid as string | undefined) ??
      ''
    certCid = rawCert.replace(/^ipfs:\/\//i, '')
    imageCid = rawImg.replace(/^ipfs:\/\//i, '')
  } catch (err) {
    results.push({
      key: 'metadata',
      label: 'metadata.json',
      cid: batch.metadataCid,
      expectedHash: batch.metadataHash,
      actualHash: null,
      matched: false,
      error: err instanceof Error ? err.message : 'Không tải được metadata.json',
    })
  }

  const checkSingle = async (
    key: 'certificate' | 'image',
    label: string,
    cid: string,
    expectedHash: `0x${string}`,
  ) => {
    if (!cid) {
      results.push({
        key,
        label,
        cid: '',
        expectedHash,
        actualHash: null,
        matched: false,
        error: `Thiếu CID của ${label} trong metadata.json`,
      })
      return
    }
    try {
      const resp = await fetch(ipfsFileUrl(cid), { signal: AbortSignal.timeout(12000) })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const buf = await resp.arrayBuffer()
      const actual = toBytes32(await sha256Hex(buf))
      results.push({
        key,
        label,
        cid,
        expectedHash,
        actualHash: actual,
        matched: actual.toLowerCase() === expectedHash.toLowerCase(),
      })
    } catch (err) {
      results.push({
        key,
        label,
        cid,
        expectedHash,
        actualHash: null,
        matched: false,
        error: err instanceof Error ? err.message : `Không tải được ${label}`,
      })
    }
  }

  await checkSingle('certificate', 'certificate.pdf', certCid, batch.certificateHash)
  await checkSingle('image', 'Ảnh gốc của lô', imageCid, batch.imageHash)

  return {
    allMatched: results.length === 3 && results.every((r) => r.matched),
    files: results,
    metadataJson,
  }
}

export async function acceptBatchTransfer(
  address: string,
  batch: LogisticsBatch,
  progress?: TxProgress,
) {
  if (!batch.pendingIncoming) throw new LogisticsChainError('Lô không có yêu cầu chờ nhận.')
  return sendTransaction(
    address,
    (contract) =>
      contract.acceptTransfer(BigInt(batch.tokenId), BigInt(batch.pendingIncoming!.requestId), [
        batch.metadataHash,
        batch.certificateHash,
        batch.imageHash,
      ]),
    progress,
  )
}

export async function rejectBatchTransfer(
  address: string,
  batch: LogisticsBatch,
  progress?: TxProgress,
) {
  if (!batch.pendingIncoming) throw new LogisticsChainError('Lô không có yêu cầu chờ nhận.')
  return sendTransaction(
    address,
    (contract) =>
      contract.rejectTransfer(BigInt(batch.tokenId), BigInt(batch.pendingIncoming!.requestId)),
    progress,
  )
}

export async function recordBatchTransit(
  address: string,
  params: {
    tokenId: string
    readingId: number
    tempC: number
    observedAtSec: number
    location: string
  },
  progress?: TxProgress,
) {
  const tempCenti = Math.round(params.tempC * 100)
  return sendTransaction(
    address,
    (contract) =>
      contract.recordTransit(
        BigInt(params.tokenId),
        BigInt(params.readingId),
        tempCenti,
        BigInt(params.observedAtSec),
        params.location.trim(),
      ),
    progress,
  )
}

export async function requestRetailerTransfer(
  address: string,
  tokenId: string,
  retailerAddress: string,
  progress?: TxProgress,
) {
  return sendTransaction(
    address,
    (contract) => contract.requestTransfer(BigInt(tokenId), retailerAddress),
    progress,
  )
}

export async function cancelRetailerTransfer(
  address: string,
  tokenId: string,
  requestId: string,
  progress?: TxProgress,
) {
  return sendTransaction(
    address,
    (contract) => contract.cancelTransfer(BigInt(tokenId), BigInt(requestId)),
    progress,
  )
}
