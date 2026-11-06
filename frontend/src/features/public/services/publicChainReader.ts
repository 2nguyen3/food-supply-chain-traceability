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
import type {
  DemoBatch,
  DemoDocument,
  DemoEvent,
  DemoOwnership,
  DemoReading,
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
const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')

/** SHA-256 trên đúng byte của tệp (không phải CID). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

function gatewayBases(): string[] {
  const configured = config.ipfsGateway ? [config.ipfsGateway.replace(/\/+$/, '')] : []
  return [...configured, 'https://gateway.pinata.cloud', 'https://ipfs.io']
}

export function ipfsFileUrl(cid: string): string {
  return `${gatewayBases()[0]}/ipfs/${cid}`
}

async function fetchIpfsBytes(cid: string, signal: AbortSignal): Promise<Uint8Array | null> {
  if (!/^[A-Za-z0-9]{10,200}$/.test(cid)) return null
  for (const base of gatewayBases()) {
    if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError')
    try {
      const timeout = AbortSignal.timeout(15000)
      const response = await fetch(`${base}/ipfs/${cid}`, {
        signal: AbortSignal.any([signal, timeout]),
      })
      if (!response.ok) continue
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length <= MAX_FILE_BYTES) return bytes
    } catch (error) {
      if (signal.aborted) throw error
    }
  }
  return null
}

const cidOf = (uri: unknown): string | undefined =>
  typeof uri === 'string' && uri.startsWith('ipfs://') ? uri.slice('ipfs://'.length) : undefined

function isoDate(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 10)
}

type Args = Record<string, unknown>
const argsOf = (log: Log | EventLog): Args => {
  const named = log as EventLog
  return (named.args ? Object.fromEntries(named.fragment.inputs.map((input, i) => [input.name, named.args[i]])) : {}) as Args
}

async function readBatchFromChain(
  provider: JsonRpcProvider,
  identity: ProductionTraceIdentity,
  signal: AbortSignal,
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

  const from = config.deployBlock
  const logs = async (name: string, ...filterArgs: unknown[]) =>
    (await contract.queryFilter(contract.filters[name](...filterArgs), from, 'latest')) as (EventLog | Log)[]
  const [created, accepted, transit, sold, incidents, recalledLogs, transfers] = await withDeadline(
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
    20000,
  )

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
  const label = async (address: string): Promise<string> => {
    if (address === ZeroAddress) return 'zero-address'
    if (!labels.has(address)) {
      let role = ''
      for (const [roleName, display] of ROLE_LABELS) {
        if (await contract.hasRole(keccak256(toUtf8Bytes(roleName)), address)) {
          role = `${display} · `
          break
        }
      }
      labels.set(address, `${role}${shortAddress(address)}`)
    }
    return labels.get(address)!
  }

  const events: DemoEvent[] = []
  const push = async (log: Log, kind: DemoEvent['kind'], detail: string) =>
    events.push({
      id: `${log.transactionHash}-${log.index}`,
      kind,
      at: await timeOf(log),
      detail,
      transactionHash: log.transactionHash,
    })
  for (const log of created) {
    const a = argsOf(log)
    await push(log, 'BatchCreated', `${await label(String(a.farmer))} khởi tạo lô ${a.batchCode} và mint NFT.`)
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
  for (const log of sold) await push(log, 'BatchSold', `Retailer ${shortAddress(String(argsOf(log).retailer))} đã bán lô.`)
  for (const log of incidents) await push(log, 'IncidentReported', `Báo cáo sự cố (CID ${argsOf(log).reportCID}).`)
  for (const log of recalledLogs) {
    const a = argsOf(log)
    await push(log, 'BatchRecalled', `Admin thu hồi lô theo sự cố #${a.incidentId} (CID lý do ${a.reasonCID}).`)
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
    })
  }
  readings.sort((x, y) => Date.parse(x.observedAt) - Date.parse(y.observedAt))

  // Metadata và hồ sơ công khai: tải qua gateway rồi băm SHA-256 trên byte gốc, đối chiếu hash trên chain
  const warnings: string[] = []
  const metadataCid = tokenUri.startsWith('ipfs://') ? tokenUri.slice('ipfs://'.length) : tokenUri
  const chainHash = (hash: string) => hash.replace(/^0x/, '').toLowerCase()
  let meta: Record<string, unknown> | null = null
  let metaVerified: DemoDocument['verified'] = 'unavailable'
  const metaBytes = await fetchIpfsBytes(metadataCid, signal)
  if (metaBytes) {
    metaVerified = (await sha256Hex(metaBytes)) === chainHash(onChain.metadataHash) ? 'match' : 'mismatch'
    if (metaVerified === 'match') {
      try {
        meta = JSON.parse(new TextDecoder().decode(metaBytes))
      } catch {
        warnings.push('Metadata không phải JSON hợp lệ.')
      }
    } else warnings.push('SHA-256 của metadata KHÔNG khớp hash trên chain: không dùng nội dung metadata này.')
  } else warnings.push('Không tải được metadata từ IPFS: chỉ hiển thị dữ liệu đọc từ hợp đồng.')

  const certificateCid = cidOf(meta?.certificateURI)
  const imageCid = cidOf(meta?.image)
  const verifyFile = async (cid: string | undefined, expected: string): Promise<DemoDocument['verified']> => {
    if (!cid) return 'unavailable'
    const bytes = await fetchIpfsBytes(cid, signal)
    if (!bytes) return 'unavailable'
    return (await sha256Hex(bytes)) === chainHash(expected) ? 'match' : 'mismatch'
  }
  const [certVerified, imageVerified] = await Promise.all([
    verifyFile(certificateCid, onChain.certificateHash),
    verifyFile(imageCid, onChain.imageHash),
  ])
  const documents: DemoDocument[] = [
    { name: 'certificate.pdf', label: 'Chứng chỉ PDF gốc', cid: certificateCid, sha256: chainHash(onChain.certificateHash), verified: certVerified, fileUrl: certificateCid ? ipfsFileUrl(certificateCid) : undefined },
    { name: 'batch.jpg', label: 'Ảnh gốc của lô', cid: imageCid, sha256: chainHash(onChain.imageHash), verified: imageVerified, fileUrl: imageCid ? ipfsFileUrl(imageCid) : undefined },
    { name: 'metadata.json', label: 'Metadata JSON công khai', cid: metadataCid, sha256: chainHash(onChain.metadataHash), verified: metaVerified, fileUrl: ipfsFileUrl(metadataCid) },
  ]
  for (const d of documents) {
    if (d.verified === 'mismatch' && d.name !== 'metadata.json') warnings.push(`SHA-256 của ${d.name} KHÔNG khớp hash trên chain.`)
  }

  const text = (key: string) => (typeof meta?.[key] === 'string' ? (meta[key] as string) : undefined)
  const num = (key: string) => (typeof meta?.[key] === 'number' ? (meta[key] as number) : undefined)
  const creator = created[0] ? String(argsOf(created[0]).farmer) : undefined

  const batch: DemoBatch = {
    code: onChain.batchCode,
    tokenId: identity.tokenId,
    farmId: onChain.farmId,
    harvestGroupId: onChain.harvestGroupId,
    lifecycle: LIFECYCLES[Number(onChain.lifecycle)] ?? 'Created',
    recalled: Boolean(onChain.recalled),
    owner: await label(owner),
    farmer: creator ? await label(creator) : 'Chưa có dữ liệu',
    quantityKg: 1000,
    farmLocation: onChain.farmLocation,
    variety: text('cultivar'),
    fertilizer: text('fertilizer'),
    harvestDate: isoDate(onChain.harvestDate),
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
    network: `${networkName} · ${config.chainId}`,
    imageUrl: imageVerified === 'match' && imageCid ? ipfsFileUrl(imageCid) : undefined,
    warnings,
  }
  return { kind: 'ok', batch }
}

export async function inspectPublicChain(
  identity: ProductionTraceIdentity,
  signal: AbortSignal,
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

    return await readBatchFromChain(provider, identity, signal)
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof Error && error.message === 'RPC_TIMEOUT') return { kind: 'rpcTimeout' }
    return { kind: 'rpcUnavailable' }
  } finally {
    provider.destroy()
  }
}
