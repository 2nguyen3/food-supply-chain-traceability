import {
  Contract,
  getAddress,
  isAddress,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
  ZeroAddress,
  type EventLog,
  type Log,
} from 'ethers'
import { config, networkName } from '../../../config/env'
import abiFile from '../../../contracts/FoodTraceability.json'
import type { Lifecycle } from '../../../domain/types'
import { sha256Hex } from '../../../lib/hash'
import { imageFormat } from '../../../lib/imageFormat'
import { readResponseBytes } from '../../../lib/readResponseBytes'
import { argsOf, makeLogQuery } from '../../../services/chainLogs'
import type {
  DemoBatch,
  DemoDocument,
  DemoEvent,
  DemoOwnership,
  DemoReading,
  DemoRecall,
} from '../mocks/traceDetailFixtures'

export interface ProductionTraceIdentity {
  chainId: string
  contractAddress: `0x${string}`
  tokenId: string
}

export type TraceParameterError = 'chainId' | 'network' | 'contractAddress' | 'tokenId'

export function parseProductionTraceParams(
  chainId?: string,
  contractAddress?: string,
  tokenId?: string,
):
  | { identity: ProductionTraceIdentity; error?: never }
  | { identity?: never; error: TraceParameterError } {
  if (!chainId || !/^\d+$/.test(chainId)) return { error: 'chainId' }
  if (BigInt(chainId) !== BigInt(config.chainId)) return { error: 'network' }
  if (!contractAddress || !isAddress(contractAddress)) return { error: 'contractAddress' }
  if (!tokenId || !/^\d+$/.test(tokenId)) return { error: 'tokenId' }

  return {
    identity: {
      chainId: BigInt(chainId).toString(),
      contractAddress: getAddress(contractAddress) as `0x${string}`,
      tokenId: BigInt(tokenId).toString(),
    },
  }
}

export type PublicReadStatus =
  | { kind: 'ok'; batch: DemoBatch }
  | { kind: 'unconfigured'; missing: string[] }
  | { kind: 'unsupportedContract' }
  | { kind: 'wrongNetwork' }
  | { kind: 'rpcTimeout' }
  | { kind: 'rpcUnavailable' }
  | { kind: 'contractMissing' }
  | { kind: 'abiMissing' }
  | { kind: 'tokenMissing' }
  | { kind: 'metadataUnavailable' }
  | { kind: 'ipfsUnavailable' }
  | { kind: 'partialData' }
  | { kind: 'hashMismatch' }

async function withDeadline<T>(
  work: Promise<T>,
  signal: AbortSignal,
  timeoutMs = 8000,
): Promise<T> {
  if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError')
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('RPC_TIMEOUT')), timeoutMs)
      }),
      new Promise<T>((_, reject) => {
        onAbort = () => reject(new DOMException('Đã hủy', 'AbortError'))
        signal.addEventListener('abort', onAbort, { once: true })
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
}

function validRpcUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const LIFECYCLES: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']
const MAX_FILE_BYTES = 11 * 1024 * 1024
const ROLE_LABELS: [string, string][] = [
  ['FARMER_ROLE', 'Farmer'],
  ['LOGISTICS_ROLE', 'Logistics'],
  ['RETAILER_ROLE', 'Retailer'],
]

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
export { sha256Hex }

function gatewayBases(): string[] {
  const configured = config.ipfsGateway ? [config.ipfsGateway.replace(/\/+$/, '')] : []
  return [...configured, 'https://gateway.pinata.cloud', 'https://ipfs.io']
}

export function ipfsFileUrl(cid: string): string {
  return `${gatewayBases()[0]}/ipfs/${cid}`
}

/** Shared IPFS fallback; also return the actual working gateway for evidence links. */
export async function fetchIpfsAsset(
  cid: string,
  signal: AbortSignal,
): Promise<{ bytes: Uint8Array; url: string } | null> {
  if (!/^[A-Za-z0-9]{10,200}$/.test(cid)) return null
  for (const base of gatewayBases()) {
    if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError')
    try {
      const url = `${base}/ipfs/${cid}`
      const timeout = AbortSignal.timeout(15000)
      const response = await fetch(url, {
        signal: AbortSignal.any([signal, timeout]),
      })
      if (!response.ok) continue
      const bytes = await readResponseBytes(response, MAX_FILE_BYTES)
      if (bytes.length === 0) continue
      return { bytes, url }
    } catch (error) {
      if (signal.aborted) throw error
    }
  }
  return null
}

export async function fetchIpfsBytes(cid: string, signal: AbortSignal): Promise<Uint8Array | null> {
  return (await fetchIpfsAsset(cid, signal))?.bytes ?? null
}

const cidOf = (uri: unknown): string | undefined =>
  typeof uri === 'string' && uri.startsWith('ipfs://') ? uri.slice('ipfs://'.length) : undefined

/** Block đầu tiên có timestamp >= mốc (tìm nhị phân); lỗi RPC thì dừng thay vì quét toàn bộ. */
async function firstBlockAtOrAfter(
  provider: JsonRpcProvider,
  seconds: number,
  floor: number,
  latest: number,
  signal: AbortSignal,
): Promise<number> {
  let lo = floor
  let hi = latest
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const block = await withDeadline(provider.getBlock(mid), signal)
    if (!block) return floor
    if (block.timestamp >= seconds) hi = mid
    else lo = mid + 1
  }
  return lo
}

async function readBatchFromChain(
  provider: JsonRpcProvider,
  identity: ProductionTraceIdentity,
  signal: AbortSignal,
  includeHistory = true,
): Promise<PublicReadStatus> {
  const contract = new Contract(identity.contractAddress, abiFile.abi, provider)
  const tokenId = BigInt(identity.tokenId)

  let onChain
  try {
    onChain = await withDeadline(contract.getBatch(tokenId), signal)
  } catch (error) {
    if (signal.aborted) throw error
    const revert = (error as { revert?: { name?: string } }).revert
    if (revert?.name === 'BatchNotFound') return { kind: 'tokenMissing' }
    if ((error as { code?: string }).code === 'CALL_EXCEPTION') return { kind: 'abiMissing' }
    throw error
  }

  const [owner, tokenUri] = await withDeadline(
    Promise.all([contract.ownerOf(tokenId), contract.tokenURI(tokenId)]),
    signal,
  )

  // First paint: never block metadata/IPFS on a potentially huge eth_getLogs backfill.
  // The optional full history is requested explicitly by the viewer.
  type ChainLogGroup = (EventLog | Log)[]
  let logGroups: [ChainLogGroup, ChainLogGroup, ChainLogGroup, ChainLogGroup, ChainLogGroup, ChainLogGroup, ChainLogGroup] = [
    [], [], [], [], [], [], [],
  ]
  if (includeHistory) {
    // History is potentially expensive on Alchemy Free (small eth_getLogs block ranges).
    const latest = await withDeadline(provider.getBlockNumber(), signal)
    const from = await firstBlockAtOrAfter(
      provider,
      Number(onChain.harvestDate),
      config.deployBlock,
      latest,
      signal,
    )
    const logs = makeLogQuery(contract, from, latest, signal)
    logGroups = await withDeadline(
      Promise.all([
        logs('BatchCreated', tokenId),
        logs('TransferAccepted', tokenId),
        logs('TransitRecorded', tokenId),
        logs('BatchSold', tokenId),
        logs('IncidentReported', null, tokenId),
        logs('BatchRecalled', tokenId),
        logs('Transfer', null, null, tokenId),
      ]),
      signal,
      45000,
    )
  }
  const [created, accepted, transit, sold, incidents, recalledLogs, transfers] = logGroups

  const blockTimes = new Map<number, string>()
  const timeOf = async (log: Log): Promise<string> => {
    if (!blockTimes.has(log.blockNumber)) {
      const block = await provider.getBlock(log.blockNumber)
      blockTimes.set(log.blockNumber, new Date((block?.timestamp ?? 0) * 1000).toISOString())
    }
    return blockTimes.get(log.blockNumber)!
  }

  // Nhãn vai trò hiện tại của từng địa chỉ (đọc từ contract); không có vai trò thì chỉ hiện địa chỉ rút gọn
  const labels = new Map<string, string>()
  const wallets: Record<string, string> = {}
  const label = async (address: string): Promise<string> => {
    if (address === ZeroAddress) return 'zero-address'
    if (!labels.has(address)) {
      if (!includeHistory) {
        const value = shortAddress(address)
        labels.set(address, value)
        wallets[value] = address
        return value
      }
      let role = ''
      for (const [roleName, display] of ROLE_LABELS) {
        if (await contract.hasRole(keccak256(toUtf8Bytes(roleName)), address)) {
          role = `${display} · `
          break
        }
      }
      labels.set(address, `${role}${shortAddress(address)}`)
      wallets[labels.get(address)!] = address
    }
    return labels.get(address)!
  }

  const events: DemoEvent[] = []
  const warnings: string[] = []
  const chainHash = (hash: string) => hash.replace(/^0x/, '').toLowerCase()
  const push = async (
    log: Log,
    kind: DemoEvent['kind'],
    detail: string,
    attachment?: DemoEvent['attachment'],
  ) =>
    events.push({
      id: `${log.transactionHash}-${log.index}`,
      kind,
      at: await timeOf(log),
      detail,
      transactionHash: log.transactionHash,
      attachment,
    })
  for (const log of created) {
    const a = argsOf(log)
    await push(
      log,
      'BatchCreated',
      `${await label(String(a.farmer))} khởi tạo lô ${a.batchCode} và mint NFT.`,
    )
  }
  for (const log of accepted) {
    const a = argsOf(log)
    await push(
      log,
      'TransferAccepted',
      `${await label(String(a.from))} bàn giao cho ${await label(String(a.to))}; đã đối chiếu 3 hash hồ sơ.`,
    )
  }
  for (const log of transit) {
    const a = argsOf(log)
    await push(log, 'TransitRecorded', `${Number(a.tempCenti) / 100}°C tại ${a.location}.`)
  }
  for (const log of sold)
    await push(
      log,
      'BatchSold',
      `Retailer ${shortAddress(String(argsOf(log).retailer))} đã bán lô.`,
    )
  for (const log of incidents) {
    const a = argsOf(log)
    const cid = cidOf(a.reportCID) ?? String(a.reportCID)
    await push(log, 'IncidentReported', `Retailer báo cáo sự cố #${a.incidentId}.`, {
      label: 'Xem báo cáo sự cố',
      url: ipfsFileUrl(cid),
    })
  }
  // Lý do thu hồi: manifest JSON có CID ghi trên chain, đối chiếu SHA-256 trên đúng byte tải về.
  // Lý do chỉ hiển thị khi manifest đúng schema và đúng lô/sự cố; PDF gốc cũng được đối chiếu hash.
  const recalledLog = recalledLogs[recalledLogs.length - 1]
  let recall: DemoRecall | undefined
  if (recalledLog) {
    const a = argsOf(recalledLog)
    const reasonCid = cidOf(a.reasonCID) ?? String(a.reasonCID)
    const reasonHash = chainHash(String(a.reasonHash))
    const manifest: DemoDocument = {
      name: 'recall-reason.json',
      label: 'Manifest lý do thu hồi',
      cid: reasonCid,
      sha256: reasonHash,
      fileUrl: undefined,
      verified: 'unavailable',
    }
    let reasonText: string | undefined
    let pdf: DemoDocument | undefined
    const manifestAsset = await fetchIpfsAsset(reasonCid, signal)
    if (manifestAsset) {
      const manifestBytes = manifestAsset.bytes
      manifest.verified = (await sha256Hex(manifestBytes)) === reasonHash ? 'match' : 'mismatch'
      // Only link to verified bytes, using the gateway that actually delivered them.
      manifest.fileUrl = manifest.verified === 'match' ? manifestAsset.url : undefined
      const isPdf = new TextDecoder().decode(manifestBytes.slice(0, 5)) === '%PDF-'
      if (manifest.verified !== 'match') {
        warnings.push(
          'SHA-256 của manifest lý do thu hồi KHÔNG khớp hash trên chain: không hiển thị lý do.',
        )
      } else if (isPdf) {
        // Bản ghi cũ lưu thẳng PDF vào reasonCID: hash vẫn khớp chain nên hiển thị tệp gốc.
        manifest.name = 'ly-do-thu-hoi.pdf'
        manifest.label = 'PDF lý do thu hồi'
        pdf = { ...manifest }
      } else {
        try {
          const json = JSON.parse(new TextDecoder().decode(manifestBytes)) as Record<
            string,
            unknown
          >
          const pdfInfo =
            json.pdf && typeof json.pdf === 'object' ? (json.pdf as Record<string, unknown>) : null
          const validSchema =
            json.kind === 'cocomark.recall-reason' &&
            Number(json.version) === 1 &&
            String(json.tokenId) === identity.tokenId &&
            Number(json.incidentId) === Number(a.incidentId)
          if (!validSchema) {
            warnings.push(
              'Manifest lý do thu hồi không đúng schema hoặc không khớp lô/sự cố ghi trên chain: không hiển thị lý do.',
            )
          } else {
            if (typeof json.reasonText === 'string' && json.reasonText.trim())
              reasonText = json.reasonText.trim()
            if (pdfInfo && typeof pdfInfo.cid === 'string' && typeof pdfInfo.sha256 === 'string') {
              const pdfCid = pdfInfo.cid
              const declared = String(pdfInfo.sha256).toLowerCase()
              const pdfAsset = await fetchIpfsAsset(pdfCid, signal)
              const pdfBytes = pdfAsset?.bytes
              const verified: DemoDocument['verified'] = pdfBytes
                ? (await sha256Hex(pdfBytes)) === declared
                  ? 'match'
                  : 'mismatch'
                : 'unavailable'
              pdf = {
                name: typeof pdfInfo.name === 'string' ? pdfInfo.name : 'ly-do-thu-hoi.pdf',
                label: 'PDF lý do thu hồi',
                cid: pdfCid,
                sha256: declared,
                // Never advertise an unverified or broken PDF URL.
                fileUrl: verified === 'match' ? pdfAsset?.url : undefined,
                verified,
              }
            }
          }
        } catch {
          warnings.push('Manifest lý do thu hồi không phải JSON hợp lệ: không hiển thị lý do.')
        }
      }
    } else {
      warnings.push('Không tải được manifest lý do thu hồi từ IPFS: chỉ hiển thị dữ liệu từ chain.')
    }
    recall = {
      incidentId: Number(a.incidentId),
      admin: await label(String(a.admin)),
      at: await timeOf(recalledLog),
      transactionHash: recalledLog.transactionHash,
      reasonCid,
      reasonHash,
      manifest,
      reasonText,
      pdf,
    }
  }

  for (const log of recalledLogs) {
    const a = argsOf(log)
    const cid = cidOf(a.reasonCID) ?? String(a.reasonCID)
    await push(log, 'BatchRecalled', `Admin thu hồi lô theo sự cố #${a.incidentId}.`, {
      label: recall?.pdf ? 'Xem lý do thu hồi (PDF)' : 'Xem manifest lý do thu hồi',
      url: recall?.pdf?.fileUrl ?? recall?.manifest?.fileUrl ?? ipfsFileUrl(cid),
    })
  }

  const ownership: DemoOwnership[] = []
  for (const log of transfers) {
    const a = argsOf(log)
    ownership.push({
      id: `${log.transactionHash}-${log.index}`,
      kind: String(a.from) === ZeroAddress ? 'mint' : 'transfer',
      from: await label(String(a.from)),
      to: await label(String(a.to)),
      at: await timeOf(log),
      transactionHash: log.transactionHash,
    })
  }

  const readings: DemoReading[] = []
  for (const log of transit) {
    const a = argsOf(log)
    readings.push({
      id: Number(a.readingId),
      temperatureC: Number(a.tempCenti) / 100,
      observedAt: new Date(Number(a.observedAt) * 1000).toISOString(),
      location: String(a.location),
      transactionHash: log.transactionHash,
      blockTime: await timeOf(log),
    })
  }
  readings.sort((x, y) => Date.parse(x.observedAt) - Date.parse(y.observedAt))

  // Metadata và hồ sơ công khai: tải qua gateway rồi băm SHA-256 trên byte gốc, đối chiếu hash trên chain
  const metadataCid = tokenUri.startsWith('ipfs://') ? tokenUri.slice('ipfs://'.length) : tokenUri
  let meta: Record<string, unknown> | null = null
  let metaVerified: DemoDocument['verified'] = 'unavailable'
  const metaBytes = await fetchIpfsBytes(metadataCid, signal)
  if (metaBytes) {
    metaVerified =
      (await sha256Hex(metaBytes)) === chainHash(onChain.metadataHash) ? 'match' : 'mismatch'
    if (metaVerified === 'match') {
      try {
        const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metaBytes))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('METADATA_INVALID')
        meta = parsed as Record<string, unknown>
      } catch {
        warnings.push('Metadata không phải JSON hợp lệ.')
      }
    } else
      warnings.push(
        'SHA-256 của metadata KHÔNG khớp hash trên chain: không dùng nội dung metadata này.',
      )
  } else warnings.push('Không tải được metadata từ IPFS: chỉ hiển thị dữ liệu đọc từ hợp đồng.')

  const certificateCid = cidOf(meta?.certificateURI)
  const imageCid = cidOf(meta?.image)
  let imageName = 'Ảnh gốc'
  const verifyFile = async (
    cid: string | undefined,
    expected: string,
  ): Promise<DemoDocument['verified']> => {
    if (!cid) return 'unavailable'
    const bytes = await fetchIpfsBytes(cid, signal)
    if (!bytes) return 'unavailable'
    if (cid === imageCid) {
      const format = imageFormat(bytes)
      if (format) imageName = `batch.${format === 'jpeg' ? 'jpg' : format}`
    }
    return (await sha256Hex(bytes)) === chainHash(expected) ? 'match' : 'mismatch'
  }
  const [certVerified, imageVerified] = await Promise.all([
    verifyFile(certificateCid, onChain.certificateHash),
    verifyFile(imageCid, onChain.imageHash),
  ])
  const documents: DemoDocument[] = [
    {
      name: 'certificate.pdf',
      kind: 'certificate',
      label: 'Chứng chỉ PDF gốc',
      cid: certificateCid,
      sha256: chainHash(onChain.certificateHash),
      verified: certVerified,
      fileUrl: certificateCid ? ipfsFileUrl(certificateCid) : undefined,
    },
    {
      name: imageName,
      kind: 'image',
      label: 'Ảnh gốc của lô',
      cid: imageCid,
      sha256: chainHash(onChain.imageHash),
      verified: imageVerified,
      fileUrl: imageCid ? ipfsFileUrl(imageCid) : undefined,
    },
    {
      name: 'metadata.json',
      kind: 'metadata',
      label: 'Metadata JSON công khai',
      cid: metadataCid,
      sha256: chainHash(onChain.metadataHash),
      verified: metaVerified,
      fileUrl: ipfsFileUrl(metadataCid),
    },
  ]
  for (const d of documents) {
    if (d.verified === 'mismatch' && d.name !== 'metadata.json')
      warnings.push(`SHA-256 của ${d.name} KHÔNG khớp hash trên chain.`)
  }
  if (recall?.pdf?.verified === 'mismatch')
    warnings.push('SHA-256 của PDF lý do thu hồi KHÔNG khớp hash khai báo trong manifest.')

  const text = (key: string) =>
    typeof meta?.[key] === 'string' ? (meta[key] as string) : undefined
  const num = (key: string) => (typeof meta?.[key] === 'number' ? (meta[key] as number) : undefined)
  const creator = created[0] ? String(argsOf(created[0]).farmer) : undefined

  const batch: DemoBatch = {
    code: onChain.batchCode,
    tokenId: identity.tokenId,
    farmId: onChain.farmId,
    harvestGroupId: onChain.harvestGroupId,
    lifecycle: LIFECYCLES[Number(onChain.lifecycle)] ?? 'Created',
    recalled: Boolean(onChain.recalled),
    recall,
    owner: await label(owner),
    farmer: creator ? await label(creator) : includeHistory ? 'Chưa có dữ liệu' : 'Chưa tải lịch sử',
    quantityKg: 1000,
    farmLocation: onChain.farmLocation,
    variety: text('cultivar'),
    fertilizer: text('fertilizer'),
    harvestDate: new Date(Number(onChain.harvestDate) * 1000).toISOString(),
    expiryDate: new Date(Number(onChain.expiryDate) * 1000).toISOString(),
    contractAddress: identity.contractAddress,
    tokenUri,
    metadataCid,
    minTemperatureC: num('tempMin'),
    maxTemperatureC: num('tempMax'),
    events,
    ownership,
    readings,
    documents,
    source: 'chain',
    historyLoaded: includeHistory,
    network: `${networkName} · ${config.chainId}`,
    imageUrl: imageVerified === 'match' && imageCid ? ipfsFileUrl(imageCid) : undefined,
    warnings,
    wallets,
    ownerAddress: owner,
    farmerAddress: creator,
  }
  return { kind: 'ok', batch }
}

export async function inspectPublicChain(
  identity: ProductionTraceIdentity,
  signal: AbortSignal,
  includeHistory = true,
): Promise<PublicReadStatus> {
  const missing: string[] = []
  if (!config.publicRpcUrl || !validRpcUrl(config.publicRpcUrl)) missing.push('VITE_PUBLIC_RPC_URL')
  if (!config.contractAddress || !isAddress(config.contractAddress))
    missing.push('VITE_CONTRACT_ADDRESS')
  if (missing.length) return { kind: 'unconfigured', missing }

  if (getAddress(config.contractAddress!) !== identity.contractAddress)
    return { kind: 'unsupportedContract' }

  const provider = new JsonRpcProvider(config.publicRpcUrl, undefined, { batchMaxCount: 1 })
  try {
    const network = await withDeadline(provider.getNetwork(), signal)
    if (network.chainId !== BigInt(config.chainId)) return { kind: 'wrongNetwork' }

    const code = await withDeadline(provider.getCode(identity.contractAddress), signal)
    if (code === '0x') return { kind: 'contractMissing' }

    return await readBatchFromChain(provider, identity, signal, includeHistory)
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof Error && error.message === 'RPC_TIMEOUT') return { kind: 'rpcTimeout' }
    return { kind: 'rpcUnavailable' }
  } finally {
    provider.destroy()
  }
}

/** Mã lô mẫu của dữ liệu seed; chỉ có trên mạng local (Sepolia thật không có sẵn các mã này). */
export const sampleBatchCodes: readonly string[] =
  config.chainId === 31337
    ? ['COCONUT-001', 'COCONUT-002', 'COCONUT-003', 'COCONUT-004', 'COCONUT-005', 'COCONUT-006']
    : []

export type TraceLookup =
  | { kind: 'found'; path: string }
  | { kind: 'notFound' }
  | { kind: 'unconfigured'; missing: string[] }
  | { kind: 'rpcTimeout' }
  | { kind: 'rpcUnavailable' }

const TRACE_URL = /\/trace\/(\d+)\/(0x[0-9a-fA-F]{40})\/(\d+)(?![\d])/

/**
 * Chuyển nội dung người dùng nhập hoặc quét thành đường dẫn trang truy xuất.
 * Nhận: URL/đường dẫn của mã QR, tokenId (số, có thể kèm #) hoặc batchCode (tra qua getTokenIdByCode).
 */
export async function resolveTraceTarget(input: string, signal: AbortSignal): Promise<TraceLookup> {
  const text = input.trim()
  if (!text) return { kind: 'notFound' }

  const fromUrl = TRACE_URL.exec(text)
  if (fromUrl) return { kind: 'found', path: `/trace/${fromUrl[1]}/${fromUrl[2]}/${fromUrl[3]}` }

  const missing: string[] = []
  if (!config.publicRpcUrl || !validRpcUrl(config.publicRpcUrl)) missing.push('VITE_PUBLIC_RPC_URL')
  if (!config.contractAddress || !isAddress(config.contractAddress))
    missing.push('VITE_CONTRACT_ADDRESS')
  if (missing.length) return { kind: 'unconfigured', missing }
  const base = `/trace/${config.chainId}/${getAddress(config.contractAddress!)}`

  const tokenText = text.replace(/^#/, '')
  if (/^\d+$/.test(tokenText) && BigInt(tokenText) > 0n)
    return { kind: 'found', path: `${base}/${BigInt(tokenText)}` }

  const provider = new JsonRpcProvider(config.publicRpcUrl, undefined, { batchMaxCount: 1 })
  try {
    const contract = new Contract(config.contractAddress!, abiFile.abi, provider)
    for (const code of new Set([text, text.toUpperCase()])) {
      const id: bigint = await withDeadline(contract.getTokenIdByCode(code), signal)
      if (id > 0n) return { kind: 'found', path: `${base}/${id}` }
    }
    return { kind: 'notFound' }
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof Error && error.message === 'RPC_TIMEOUT') return { kind: 'rpcTimeout' }
    return { kind: 'rpcUnavailable' }
  } finally {
    provider.destroy()
  }
}
