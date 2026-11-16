/**
 * Đọc dữ liệu Admin trực tiếp từ hợp đồng FoodTraceability (chỉ đọc).
 *
 * Nguyên tắc:
 * - Sự kiện (`BatchCreated`, `IncidentReported`, `BatchRecalled`, `RoleGranted`, ...) dùng để
 *   dựng lịch sử và danh sách; trạng thái hiện tại luôn xác minh lại bằng hàm đọc của hợp đồng
 *   (`getBatch`, `getIncident`, `hasRole`, `farmIdOf`, `isExpired`, `ownerOf`).
 * - Không mã hóa cứng mã lô, số liệu hay địa chỉ ví: mọi giá trị đều suy ra từ chain.
 * - Mọi số liệu đo được (thời gian, số lần gọi RPC, số event) trả về trong `metrics` để báo cáo.
 */
import { Contract, getAddress, isAddress, JsonRpcProvider, type EventLog, type Log } from 'ethers'
import { config } from '../../../config/env'
import abiFile from '../../../contracts/FoodTraceability.json'
import type { Lifecycle, Role } from '../../../domain/types'
import { sha256Hex } from '../../../lib/hash'
import { argsOf, makeLogQuery } from '../../../services/chainLogs'
import { roleHash } from '../../../services/roles'
import { ipfsFileUrl } from '../../public/services/publicChainReader'

const LIFECYCLES: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']
const ROLES: Role[] = ['admin', 'farmer', 'logistics', 'retailer']
const ROLE_BY_HASH = new Map(ROLES.map((role) => [roleHash(role).toLowerCase(), role]))
const MAX_ARTIFACT_BYTES = 11 * 1024 * 1024
const ARTIFACT_TIMEOUT_MS = 15000
const FEED_SIZE = 12

/** Khóa JSON có thể chứa mô tả sự cố; chỉ đọc khi báo cáo thật sự là JSON. */
const DESCRIPTION_KEYS = ['description', 'moTa', 'mo_ta', 'note', 'reason', 'details']

export type AdminChainErrorKind = 'unconfigured' | 'network' | 'rpc' | 'notFound'

export class AdminChainError extends Error {
  readonly kind: AdminChainErrorKind

  constructor(kind: AdminChainErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface AdminReadMetrics {
  /** Thời gian đọc thực tế (ms), gồm cả tải tệp IPFS nếu có. */
  durationMs: number
  /** Số lần gọi RPC hợp lý đã phát ra (không tính lần thử lại khi RPC giới hạn khoảng block). */
  rpcCalls: number
  /** Số event đã giải mã. */
  events: number
}

export interface AdminRecallInfo {
  tokenId: string
  incidentId: number
  admin: `0x${string}`
  reasonCid: string
  reasonHash: string
  at: string
  txHash: string
  blockNumber: number
}

export interface AdminBatchRow {
  tokenId: string
  batchCode: string
  farmId: string
  harvestGroupId: string
  farmLocation: string
  lifecycle: Lifecycle
  /** Trạng thái hiện tại đọc bằng getBatch (event chỉ dựng lịch sử). */
  recalled: boolean
  expired: boolean
  quantityKg: number
  harvestDate: string
  expiryDate: string
  owner: `0x${string}`
  farmer: `0x${string}` | null
  createdAt: string | null
  createTx: string | null
  recall: AdminRecallInfo | null
}

export interface AdminIncidentRow {
  incidentId: number
  tokenId: string
  batchCode: string
  farmId: string
  harvestGroupId: string
  lifecycle: Lifecycle
  /** Lô của sự cố đã bị thu hồi (đọc từ getBatch). */
  batchRecalled: boolean
  reporter: `0x${string}`
  reportCid: string
  reportHash: string
  reportedAt: string
  blockNumber: number | null
  txHash: string | null
  /** getIncident trả về đúng sự cố này (đối chiếu event với trạng thái hiện tại). */
  verifiedOnChain: boolean
  recall: AdminRecallInfo | null
}

export interface AdminEvent {
  id: string
  kind:
    | 'BatchCreated'
    | 'TransferAccepted'
    | 'TransitRecorded'
    | 'BatchSold'
    | 'IncidentReported'
    | 'BatchRecalled'
  at: string
  blockNumber: number
  tokenId: string | null
  batchCode: string | null
  detail: string
  txHash: string
}

export interface AdminOverview {
  totalBatches: number
  totalIncidents: number
  recalledBatches: number
  openIncidents: number
  events: AdminEvent[]
  metrics: AdminReadMetrics
}

export interface AdminRoleHolder {
  address: `0x${string}`
  roles: Role[]
  farmId: string | null
}

export interface AdminRoleChange {
  address: `0x${string}`
  role: Role
  action: 'granted' | 'revoked'
  at: string
  blockNumber: number
  logIndex: number
  txHash: string
}

export interface AdminFarmRow {
  address: `0x${string}`
  farmId: string | null
  activeFarmer: boolean
  batchCount: number
  assignedAt: string | null
  assignTx: string | null
}

export interface AdminOwnershipStep {
  kind: 'mint' | 'transfer'
  from: `0x${string}`
  to: `0x${string}`
  at: string
  txHash: string
}

export interface AdminReading {
  readingId: number
  temperatureC: number
  observedAt: string
  location: string
  at: string
  txHash: string
}

export interface AdminArtifact {
  cid: string
  fileUrl: string
  /** SHA-256 on-chain (hex thường, không 0x). */
  expectedSha256: string
  /** SHA-256 tính trên byte tải về; null khi không tải được. */
  computedSha256: string | null
  verified: 'match' | 'mismatch' | 'unavailable'
  kind: 'pdf' | 'json' | 'other'
  json: unknown
  text: string | null
}

export interface AdminSoldInfo {
  retailer: `0x${string}`
  /** Thời điểm bán theo event (uint64). */
  soldAt: string
  /** Thời gian block chứa giao dịch. */
  at: string
  txHash: string
}

export interface AdminIncidentDetail {
  incident: AdminIncidentRow
  batch: AdminBatchRow
  report: AdminArtifact
  /** Mô tả chỉ lấy từ trường văn bản của báo cáo JSON; PDF thì null. */
  description: string | null
  ownership: AdminOwnershipStep[]
  readings: AdminReading[]
  /** Cùng farmId + harvestGroupId (diện xem xét). */
  related: AdminBatchRow[]
  /** Cùng farmId nhưng khác harvestGroupId (đối chứng). */
  sameFarmOtherGroup: AdminBatchRow[]
  /** Khác farmId (đối chứng). */
  otherFarm: AdminBatchRow[]
  /** Toàn bộ sự cố trên chain, dùng cho ô chọn sự cố tham chiếu khi thu hồi. */
  incidents: AdminIncidentRow[]
  /** Giao dịch BatchSold của lô, nếu đã bán. */
  sold: AdminSoldInfo | null
  /** Vai trò hiện tại (hasRole) của các ví trong hành trình, chỉ để hiển thị. */
  roleLabels: Record<string, Role[]>
  /** Tệp lý do thu hồi trên chain (CID trong event BatchRecalled) đã đối chiếu hash. */
  recallArtifact: AdminArtifact | null
  /** Lý do thu hồi chỉ đọc từ manifest JSON hợp lệ; PDF hoặc dữ liệu khác thì null. */
  recallReasonText: string | null
  metrics: AdminReadMetrics
}

interface ChainContext {
  provider: JsonRpcProvider
  contract: Contract
  latest: number
  call: <T>(work: Promise<T>) => Promise<T>
  query: (name: string, ...args: unknown[]) => Promise<(EventLog | Log)[]>
  timeOf: (blockNumber: number) => Promise<string>
  stats: { rpcCalls: number; events: number }
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
const asAddress = (value: string) => getAddress(value) as `0x${string}`
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const toIso = (seconds: bigint | number) => new Date(Number(seconds) * 1000).toISOString()
const chainHashHex = (value: unknown) =>
  String(value ?? '')
    .replace(/^0x/, '')
    .toLowerCase()

function cidOf(uri: unknown): string {
  const text = typeof uri === 'string' ? uri : ''
  return text.startsWith('ipfs://') ? text.slice('ipfs://'.length) : text
}

function assertLive(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError')
}

function isUnknownIncident(error: unknown): boolean {
  const revert = (error as { revert?: { name?: string } }).revert
  if (revert?.name === 'UnknownIncident') return true
  return error instanceof Error && error.message.includes('UnknownIncident')
}

function isBatchNotFound(error: unknown): boolean {
  const revert = (error as { revert?: { name?: string } }).revert
  if (revert?.name === 'BatchNotFound') return true
  return error instanceof Error && error.message.includes('BatchNotFound')
}

async function withChain<T>(
  signal: AbortSignal,
  work: (ctx: ChainContext) => Promise<T>,
): Promise<T> {
  const missing: string[] = []
  if (!config.publicRpcUrl) missing.push('VITE_PUBLIC_RPC_URL')
  if (!config.contractAddress || !isAddress(config.contractAddress))
    missing.push('VITE_CONTRACT_ADDRESS')
  if (missing.length)
    throw new AdminChainError(
      'unconfigured',
      `Thiếu cấu hình ${missing.join(', ')} để đọc dữ liệu Admin.`,
    )

  assertLive(signal)
  const provider = new JsonRpcProvider(config.publicRpcUrl, undefined, { batchMaxCount: 1 })
  const stats = { rpcCalls: 0, events: 0 }
  const blockTimes = new Map<number, string>()
  try {
    const network = await provider.getNetwork()
    stats.rpcCalls += 1
    if (network.chainId !== BigInt(config.chainId))
      throw new AdminChainError(
        'network',
        `RPC trả về chain ${network.chainId}, cấu hình yêu cầu ${config.chainId}.`,
      )

    const latest = await provider.getBlockNumber()
    stats.rpcCalls += 1
    const contract = new Contract(config.contractAddress!, abiFile.abi, provider)
    const rawQuery = makeLogQuery(contract, config.deployBlock, latest, signal)

    const ctx: ChainContext = {
      provider,
      contract,
      latest,
      stats,
      call: <R>(work: Promise<R>) => {
        stats.rpcCalls += 1
        return work
      },
      query: async (name, ...args) => {
        stats.rpcCalls += 1
        const found = await rawQuery(name, ...args)
        stats.events += found.length
        return found
      },
      timeOf: async (blockNumber) => {
        const cached = blockTimes.get(blockNumber)
        if (cached) return cached
        stats.rpcCalls += 1
        const block = await provider.getBlock(blockNumber)
        const iso = new Date((block?.timestamp ?? 0) * 1000).toISOString()
        blockTimes.set(blockNumber, iso)
        return iso
      },
    }

    return await work(ctx)
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof AdminChainError) throw error
    throw new AdminChainError(
      'rpc',
      'Không đọc được dữ liệu từ blockchain. Kiểm tra Hardhat/RPC và thử lại.',
    )
  } finally {
    provider.destroy()
  }
}

function metricsOf(ctx: ChainContext, started: number): AdminReadMetrics {
  return {
    durationMs: Math.round(performance.now() - started),
    rpcCalls: ctx.stats.rpcCalls,
    events: ctx.stats.events,
  }
}

async function recallMap(
  ctx: ChainContext,
  logs: (EventLog | Log)[],
): Promise<Map<string, AdminRecallInfo>> {
  const map = new Map<string, AdminRecallInfo>()
  for (const log of logs) {
    const a = argsOf(log)
    const tokenId = String(a.tokenId)
    map.set(tokenId, {
      tokenId,
      incidentId: Number(a.incidentId),
      admin: asAddress(String(a.admin)),
      reasonCid: cidOf(a.reasonCID),
      reasonHash: chainHashHex(a.reasonHash),
      at: await ctx.timeOf(log.blockNumber),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    })
  }
  return map
}

async function buildBatchRows(
  ctx: ChainContext,
  createdLogs: (EventLog | Log)[],
  recallLogs: (EventLog | Log)[],
): Promise<AdminBatchRow[]> {
  const recalls = await recallMap(ctx, recallLogs)
  const rows = await Promise.all(
    createdLogs.map(async (log) => {
      const a = argsOf(log)
      const tokenId = BigInt(String(a.tokenId))
      const [info, owner, expired] = await Promise.all([
        ctx.call(ctx.contract.getBatch(tokenId)),
        ctx.call(ctx.contract.ownerOf(tokenId)),
        ctx.call(ctx.contract.isExpired(tokenId)),
      ])
      const row: AdminBatchRow = {
        tokenId: tokenId.toString(),
        batchCode: String(info.batchCode),
        farmId: String(info.farmId),
        harvestGroupId: String(info.harvestGroupId),
        farmLocation: String(info.farmLocation),
        lifecycle: LIFECYCLES[Number(info.lifecycle)] ?? 'Created',
        recalled: Boolean(info.recalled),
        expired: Boolean(expired),
        quantityKg: Number(info.quantityKg),
        harvestDate: toIso(info.harvestDate),
        expiryDate: toIso(info.expiryDate),
        owner: asAddress(String(owner)),
        farmer: a.farmer ? asAddress(String(a.farmer)) : null,
        createdAt: await ctx.timeOf(log.blockNumber),
        createTx: log.transactionHash,
        recall: recalls.get(tokenId.toString()) ?? null,
      }
      return row
    }),
  )
  rows.sort((x, y) => Number(x.tokenId) - Number(y.tokenId))
  return rows
}

async function buildIncidentRows(
  ctx: ChainContext,
  incidentLogs: (EventLog | Log)[],
  batches: AdminBatchRow[],
): Promise<AdminIncidentRow[]> {
  const byToken = new Map(batches.map((batch) => [batch.tokenId, batch]))
  const rows = await Promise.all(
    incidentLogs.map(async (log) => {
      const a = argsOf(log)
      const incidentId = Number(a.incidentId)
      const tokenId = String(a.tokenId)
      const batch = byToken.get(tokenId)
      let incident: Record<string, unknown> | null = null
      try {
        incident = (await ctx.call(ctx.contract.getIncident(BigInt(incidentId)))) as Record<
          string,
          unknown
        >
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error
        incident = null
      }
      const onChainToken = incident ? String(incident.tokenId) : null
      const verifiedOnChain = Boolean(incident) && onChainToken === tokenId
      const row: AdminIncidentRow = {
        incidentId,
        tokenId,
        batchCode: batch?.batchCode ?? `#${tokenId}`,
        farmId: batch?.farmId ?? '',
        harvestGroupId: batch?.harvestGroupId ?? '',
        lifecycle: batch?.lifecycle ?? 'Created',
        batchRecalled: batch?.recalled ?? false,
        reporter: asAddress(String(a.retailer)),
        reportCid: cidOf(a.reportCID),
        reportHash: chainHashHex(a.reportHash),
        reportedAt: incident?.timestamp
          ? toIso(incident.timestamp as bigint)
          : await ctx.timeOf(log.blockNumber),
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        verifiedOnChain,
        recall: batch?.recall ?? null,
      }
      return row
    }),
  )
  rows.sort((x, y) => x.incidentId - y.incidentId)
  return rows
}

async function buildEventFeed(
  ctx: ChainContext,
  created: (EventLog | Log)[],
  incidentLogs: (EventLog | Log)[],
  recallLogs: (EventLog | Log)[],
  batches: AdminBatchRow[],
): Promise<AdminEvent[]> {
  const codeByToken = new Map(batches.map((batch) => [batch.tokenId, batch.batchCode]))
  const [accepted, transit, sold] = await Promise.all([
    ctx.query('TransferAccepted'),
    ctx.query('TransitRecorded'),
    ctx.query('BatchSold'),
  ])
  const events: AdminEvent[] = []
  const push = async (
    log: EventLog | Log,
    kind: AdminEvent['kind'],
    tokenId: string,
    detail: string,
  ) => {
    events.push({
      id: `${log.transactionHash}-${log.index}`,
      kind,
      at: await ctx.timeOf(log.blockNumber),
      blockNumber: log.blockNumber,
      tokenId,
      batchCode: codeByToken.get(tokenId) ?? null,
      detail,
      txHash: log.transactionHash,
    })
  }

  for (const log of created) {
    const a = argsOf(log)
    const tokenId = String(a.tokenId)
    await push(
      log,
      'BatchCreated',
      tokenId,
      `${a.batchCode}: ${shortAddress(String(a.farmer))} khởi tạo lô.`,
    )
  }
  for (const log of accepted) {
    const a = argsOf(log)
    const tokenId = String(a.tokenId)
    await push(
      log,
      'TransferAccepted',
      tokenId,
      `${codeByToken.get(tokenId) ?? `#${tokenId}`}: bàn giao ${shortAddress(String(a.from))} → ${shortAddress(String(a.to))}.`,
    )
  }
  for (const log of transit) {
    const a = argsOf(log)
    const tokenId = String(a.tokenId)
    await push(
      log,
      'TransitRecorded',
      tokenId,
      `${codeByToken.get(tokenId) ?? `#${tokenId}`}: ${Number(a.tempCenti) / 100}°C tại ${a.location}.`,
    )
  }
  for (const log of sold) {
    const a = argsOf(log)
    const tokenId = String(a.tokenId)
    await push(
      log,
      'BatchSold',
      tokenId,
      `${codeByToken.get(tokenId) ?? `#${tokenId}`}: Retailer ${shortAddress(String(a.retailer))} đã bán lô.`,
    )
  }
  for (const log of incidentLogs) {
    const a = argsOf(log)
    const tokenId = String(a.tokenId)
    await push(
      log,
      'IncidentReported',
      tokenId,
      `${codeByToken.get(tokenId) ?? `#${tokenId}`}: sự cố #${a.incidentId} do ${shortAddress(String(a.retailer))} báo cáo.`,
    )
  }
  for (const log of recallLogs) {
    const a = argsOf(log)
    const tokenId = String(a.tokenId)
    await push(
      log,
      'BatchRecalled',
      tokenId,
      `${codeByToken.get(tokenId) ?? `#${tokenId}`}: Admin thu hồi theo sự cố #${a.incidentId}.`,
    )
  }

  events.sort((x, y) => y.blockNumber - x.blockNumber || y.id.localeCompare(x.id))
  return events.slice(0, FEED_SIZE)
}

/** KPI tổng quan + dòng sự kiện gần nhất, đọc thật từ chain. */
export async function readAdminOverview(signal: AbortSignal): Promise<AdminOverview> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    const [created, incidentLogs, recallLogs] = await Promise.all([
      ctx.query('BatchCreated'),
      ctx.query('IncidentReported'),
      ctx.query('BatchRecalled'),
    ])
    const batches = await buildBatchRows(ctx, created, recallLogs)
    const incidents = await buildIncidentRows(ctx, incidentLogs, batches)
    const events = await buildEventFeed(ctx, created, incidentLogs, recallLogs, batches)
    return {
      totalBatches: batches.length,
      totalIncidents: incidents.length,
      recalledBatches: batches.filter((batch) => batch.recalled).length,
      openIncidents: incidents.filter((incident) => !incident.batchRecalled).length,
      events,
      metrics: metricsOf(ctx, started),
    }
  })
}

/** Danh sách mọi lô trên chain, kèm trạng thái hiện tại và quyết định thu hồi. */
export async function readAdminBatches(
  signal: AbortSignal,
): Promise<{ batches: AdminBatchRow[]; metrics: AdminReadMetrics }> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    const [created, recallLogs] = await Promise.all([
      ctx.query('BatchCreated'),
      ctx.query('BatchRecalled'),
    ])
    const batches = await buildBatchRows(ctx, created, recallLogs)
    return { batches, metrics: metricsOf(ctx, started) }
  })
}

/** Một lô theo tokenId; không tồn tại thì báo notFound thay vì bịa dữ liệu. */
export async function readAdminBatch(
  tokenId: string,
  signal: AbortSignal,
): Promise<{ batch: AdminBatchRow; metrics: AdminReadMetrics }> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    const [created, recallLogs] = await Promise.all([
      ctx.query('BatchCreated'),
      ctx.query('BatchRecalled'),
    ])
    const id = BigInt(tokenId)
    const log = created.find((entry) => String(argsOf(entry).tokenId) === id.toString())
    if (!log) {
      try {
        await ctx.call(ctx.contract.getBatch(id))
      } catch (error) {
        if (isBatchNotFound(error))
          throw new AdminChainError('notFound', `Không tìm thấy lô token #${tokenId}.`)
        throw error
      }
      throw new AdminChainError('notFound', `Không tìm thấy event khởi tạo của lô #${tokenId}.`)
    }
    const [batch] = await buildBatchRows(ctx, [log], recallLogs)
    return { batch, metrics: metricsOf(ctx, started) }
  })
}

export interface AdminBatchDocument {
  key: 'certificate' | 'image' | 'metadata'
  name: string
  label: string
  cid: string
  /** SHA-256 on-chain (hex thường, không 0x). */
  sha256: string
  fileUrl: string
  verified: 'match' | 'mismatch' | 'unavailable'
}

export interface AdminBatchDetail {
  batch: AdminBatchRow
  tokenUri: string
  metadataCid: string
  variety: string | null
  fertilizer: string | null
  tempMin: number | null
  tempMax: number | null
  documents: AdminBatchDocument[]
  ownership: AdminOwnershipStep[]
  readings: AdminReading[]
  sold: AdminSoldInfo | null
  /** Toàn bộ sự cố trên chain; trang tự lọc sự cố của lô này. */
  incidents: AdminIncidentRow[]
  recallArtifact: AdminArtifact | null
  recallReasonText: string | null
  roleLabels: Record<string, Role[]>
  metrics: AdminReadMetrics
}

/** Chi tiết một lô theo batchCode: hồ sơ IPFS đối chiếu hash, hành trình, nhiệt độ, QR. */
export async function readAdminBatchDetail(
  batchCode: string,
  signal: AbortSignal,
): Promise<AdminBatchDetail> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    const [created, recallLogs, incidentLogs] = await Promise.all([
      ctx.query('BatchCreated'),
      ctx.query('BatchRecalled'),
      ctx.query('IncidentReported'),
    ])
    const batches = await buildBatchRows(ctx, created, recallLogs)
    const batch = batches.find((row) => row.batchCode === batchCode)
    if (!batch) throw new AdminChainError('notFound', `Không tìm thấy lô ${batchCode}.`)

    const tokenId = BigInt(batch.tokenId)
    const [transfers, transitLogs, soldLogs, tokenUri, info] = await Promise.all([
      ctx.query('Transfer', null, null, tokenId),
      ctx.query('TransitRecorded', tokenId),
      ctx.query('BatchSold', tokenId),
      ctx.call(ctx.contract.tokenURI(tokenId)) as Promise<string>,
      ctx.call(ctx.contract.getBatch(tokenId)) as Promise<Record<string, unknown>>,
    ])

    const ownership: AdminOwnershipStep[] = []
    for (const log of transfers) {
      const a = argsOf(log)
      ownership.push({
        kind: String(a.from) === ZERO_ADDRESS ? 'mint' : 'transfer',
        from: asAddress(String(a.from)),
        to: asAddress(String(a.to)),
        at: await ctx.timeOf(log.blockNumber),
        txHash: log.transactionHash,
      })
    }
    ownership.sort((x, y) => Date.parse(x.at) - Date.parse(y.at))

    const readings: AdminReading[] = []
    for (const log of transitLogs) {
      const a = argsOf(log)
      readings.push({
        readingId: Number(a.readingId),
        temperatureC: Number(a.tempCenti) / 100,
        observedAt: toIso(a.observedAt as bigint),
        location: String(a.location),
        at: await ctx.timeOf(log.blockNumber),
        txHash: log.transactionHash,
      })
    }
    readings.sort((x, y) => Date.parse(x.observedAt) - Date.parse(y.observedAt))

    const soldLog = soldLogs[soldLogs.length - 1]
    let sold: AdminSoldInfo | null = null
    if (soldLog) {
      const a = argsOf(soldLog)
      sold = {
        retailer: asAddress(String(a.retailer)),
        soldAt: toIso(a.soldAt as bigint),
        at: await ctx.timeOf(soldLog.blockNumber),
        txHash: soldLog.transactionHash,
      }
    }

    const incidents = await buildIncidentRows(ctx, incidentLogs, batches)
    const batchIncidents = incidents.filter((row) => row.tokenId === batch.tokenId)

    const metadataCid = cidOf(tokenUri)
    const metadataArtifact = await readArtifact(
      metadataCid,
      chainHashHex(info.metadataHash),
      signal,
    )
    const meta =
      metadataArtifact.verified === 'match' &&
      metadataArtifact.json &&
      typeof metadataArtifact.json === 'object'
        ? (metadataArtifact.json as Record<string, unknown>)
        : null
    const metaText = (key: string) =>
      typeof meta?.[key] === 'string' ? (meta[key] as string) : null
    const metaNumber = (key: string) =>
      typeof meta?.[key] === 'number' ? (meta[key] as number) : null
    const certificateCid = cidOf(meta?.certificateURI)
    const imageCid = cidOf(meta?.image)
    const [certificateArtifact, imageArtifact] = await Promise.all([
      certificateCid
        ? readArtifact(certificateCid, chainHashHex(info.certificateHash), signal)
        : Promise.resolve(null),
      imageCid
        ? readArtifact(imageCid, chainHashHex(info.imageHash), signal)
        : Promise.resolve(null),
    ])

    const document = (
      key: AdminBatchDocument['key'],
      name: string,
      label: string,
      cid: string,
      hash: unknown,
      artifact: AdminArtifact | null,
    ): AdminBatchDocument => ({
      key,
      name,
      label,
      cid,
      sha256: chainHashHex(hash),
      fileUrl: cid ? ipfsFileUrl(cid) : '',
      verified: artifact?.verified ?? 'unavailable',
    })
    const documents: AdminBatchDocument[] = [
      document(
        'certificate',
        'certificate.pdf',
        'Chứng chỉ PDF gốc',
        certificateCid,
        info.certificateHash,
        certificateArtifact,
      ),
      document('image', 'batch.jpg', 'Ảnh gốc của lô', imageCid, info.imageHash, imageArtifact),
      document(
        'metadata',
        'metadata.json',
        'Metadata JSON công khai',
        metadataCid,
        info.metadataHash,
        metadataArtifact,
      ),
    ]

    const recallArtifact = batch.recall
      ? await readArtifact(batch.recall.reasonCid, batch.recall.reasonHash, signal)
      : null

    const involved = new Set<string>([batch.owner, batch.farmer ?? ''])
    for (const step of ownership) {
      if (step.from !== ZERO_ADDRESS) involved.add(step.from)
      if (step.to !== ZERO_ADDRESS) involved.add(step.to)
    }
    if (sold) involved.add(sold.retailer)
    for (const incident of batchIncidents) involved.add(incident.reporter)
    involved.delete('')
    const roleLabels: Record<string, Role[]> = {}
    await Promise.all(
      [...involved].map(async (address) => {
        const active = await Promise.all(
          ROLES.map(
            (role) => ctx.call(ctx.contract.hasRole(roleHash(role), address)) as Promise<boolean>,
          ),
        )
        roleLabels[address] = ROLES.filter((_, index) => active[index])
      }),
    )

    return {
      batch,
      tokenUri,
      metadataCid,
      variety: metaText('cultivar'),
      fertilizer: metaText('fertilizer'),
      tempMin: metaNumber('tempMin'),
      tempMax: metaNumber('tempMax'),
      documents,
      ownership,
      readings,
      sold,
      incidents,
      recallArtifact,
      recallReasonText: recallReasonText(recallArtifact, batch.recall),
      roleLabels,
      metrics: metricsOf(ctx, started),
    }
  })
}

/** Danh sách sự cố từ event `IncidentReported`, đối chiếu `getIncident` và `getBatch`. */
export async function readAdminIncidents(
  signal: AbortSignal,
): Promise<{ incidents: AdminIncidentRow[]; metrics: AdminReadMetrics }> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    const [created, incidentLogs, recallLogs] = await Promise.all([
      ctx.query('BatchCreated'),
      ctx.query('IncidentReported'),
      ctx.query('BatchRecalled'),
    ])
    const batches = await buildBatchRows(ctx, created, recallLogs)
    const incidents = await buildIncidentRows(ctx, incidentLogs, batches)
    return { incidents, metrics: metricsOf(ctx, started) }
  })
}

async function readArtifact(
  cid: string,
  expectedHash: string,
  signal: AbortSignal,
): Promise<AdminArtifact> {
  const expected = chainHashHex(expectedHash)
  const empty: AdminArtifact = {
    cid,
    fileUrl: ipfsFileUrl(cid),
    expectedSha256: expected,
    computedSha256: null,
    verified: 'unavailable',
    kind: 'other',
    json: null,
    text: null,
  }
  if (!cid) return empty
  try {
    const response = await fetch(empty.fileUrl, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(ARTIFACT_TIMEOUT_MS)]),
    })
    if (!response.ok) return empty
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_ARTIFACT_BYTES) return empty
    const computedSha256 = await sha256Hex(bytes)
    const isPdf =
      bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    let json: unknown = null
    let text: string | null = null
    if (!isPdf) {
      text = new TextDecoder().decode(bytes)
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
    }
    return {
      ...empty,
      computedSha256,
      verified: computedSha256 === expected ? 'match' : 'mismatch',
      kind: isPdf ? 'pdf' : json ? 'json' : 'other',
      json,
      text,
    }
  } catch {
    return empty
  }
}

/** Mô tả sự cố chỉ đọc từ trường văn bản của báo cáo JSON; PDF không tự sinh mô tả. */
export function incidentDescription(artifact: AdminArtifact): string | null {
  if (!artifact.json || typeof artifact.json !== 'object') return null
  const record = artifact.json as Record<string, unknown>
  for (const key of DESCRIPTION_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export interface RecallManifestPdf {
  cid: string
  sha256: string
  name: string
  sizeBytes: number
}

/** Manifest lý do thu hồi chỉ được chấp nhận khi đúng schema và đúng lô/sự cố đã ghi trên chain. */
function recallManifest(
  artifact: AdminArtifact | null,
  recall: AdminRecallInfo | null,
): Record<string, unknown> | null {
  if (!artifact?.json || !recall || typeof artifact.json !== 'object') return null
  const record = artifact.json as Record<string, unknown>
  if (record.kind !== 'cocomark.recall-reason' || Number(record.version) !== 1) return null
  if (String(record.tokenId) !== recall.tokenId) return null
  if (Number(record.incidentId) !== recall.incidentId) return null
  return record
}

/** Lý do thu hồi đọc từ `reasonText` của manifest JSON hợp lệ; PDF hoặc dữ liệu khác thì null. */
export function recallReasonText(
  artifact: AdminArtifact | null,
  recall: AdminRecallInfo | null,
): string | null {
  const record = recallManifest(artifact, recall)
  const text = record?.reasonText
  return typeof text === 'string' && text.trim() ? text.trim() : null
}

/** Tệp PDF gốc trong manifest lý do thu hồi, kèm hash đã khai báo lúc thu hồi. */
export function recallManifestPdf(
  artifact: AdminArtifact | null,
  recall: AdminRecallInfo | null,
): RecallManifestPdf | null {
  const record = recallManifest(artifact, recall)
  const pdf = record?.pdf
  if (!pdf || typeof pdf !== 'object') return null
  const value = pdf as Record<string, unknown>
  const cid = typeof value.cid === 'string' ? value.cid : ''
  const sha256 = typeof value.sha256 === 'string' ? value.sha256 : ''
  const name = typeof value.name === 'string' ? value.name : 'ly-do-thu-hoi.pdf'
  const sizeBytes = Number(value.sizeBytes)
  if (!cid || !sha256 || !Number.isFinite(sizeBytes)) return null
  return { cid, sha256, name, sizeBytes }
}

/** Chi tiết sự cố: truy ngược lô, lô liên quan theo farmId + harvestGroupId, quyết định thu hồi. */
export async function readAdminIncidentDetail(
  incidentId: number,
  signal: AbortSignal,
): Promise<AdminIncidentDetail> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    let incident: Record<string, unknown>
    try {
      incident = (await ctx.call(ctx.contract.getIncident(BigInt(incidentId)))) as Record<
        string,
        unknown
      >
    } catch (error) {
      if (isUnknownIncident(error))
        throw new AdminChainError(
          'notFound',
          `Không tìm thấy sự cố #${incidentId} trên blockchain.`,
        )
      throw error
    }

    const tokenId = BigInt(String(incident.tokenId))
    const [created, incidentLogs, recallLogs] = await Promise.all([
      ctx.query('BatchCreated'),
      ctx.query('IncidentReported'),
      ctx.query('BatchRecalled'),
    ])
    const batches = await buildBatchRows(ctx, created, recallLogs)
    const batch = batches.find((entry) => entry.tokenId === tokenId.toString())
    if (!batch)
      throw new AdminChainError(
        'notFound',
        `Không tìm thấy lô #${tokenId} của sự cố #${incidentId}.`,
      )

    const incidentRows = await buildIncidentRows(ctx, incidentLogs, batches)
    const incidentRow = incidentRows.find((row) => row.incidentId === incidentId) ?? null

    const [transfers, transitLogs, soldLogs] = await Promise.all([
      ctx.query('Transfer', null, null, tokenId),
      ctx.query('TransitRecorded', tokenId),
      ctx.query('BatchSold', tokenId),
    ])

    const ownership: AdminOwnershipStep[] = []
    for (const log of transfers) {
      const a = argsOf(log)
      ownership.push({
        kind: String(a.from) === '0x0000000000000000000000000000000000000000' ? 'mint' : 'transfer',
        from: asAddress(String(a.from)),
        to: asAddress(String(a.to)),
        at: await ctx.timeOf(log.blockNumber),
        txHash: log.transactionHash,
      })
    }
    ownership.sort((x, y) => Date.parse(x.at) - Date.parse(y.at))

    const readings: AdminReading[] = []
    for (const log of transitLogs) {
      const a = argsOf(log)
      readings.push({
        readingId: Number(a.readingId),
        temperatureC: Number(a.tempCenti) / 100,
        observedAt: toIso(a.observedAt as bigint),
        location: String(a.location),
        at: await ctx.timeOf(log.blockNumber),
        txHash: log.transactionHash,
      })
    }
    readings.sort((x, y) => Date.parse(x.observedAt) - Date.parse(y.observedAt))

    // Nhãn vai trò hiện tại chỉ để đọc hành trình; quyết định thu hồi không dựa vào nhãn này.
    const involved = new Set<string>([
      batch.owner,
      batch.farmer ?? '',
      asAddress(String(incident.reporter)),
    ])
    for (const step of ownership) {
      if (step.from !== ZERO_ADDRESS) involved.add(step.from)
      if (step.to !== ZERO_ADDRESS) involved.add(step.to)
    }
    involved.delete('')
    const roleLabels: Record<string, Role[]> = {}
    await Promise.all(
      [...involved].map(async (address) => {
        const active = await Promise.all(
          ROLES.map(
            (role) => ctx.call(ctx.contract.hasRole(roleHash(role), address)) as Promise<boolean>,
          ),
        )
        roleLabels[address] = ROLES.filter((_, index) => active[index])
      }),
    )

    const soldLog = soldLogs[soldLogs.length - 1]
    let sold: AdminSoldInfo | null = null
    if (soldLog) {
      const a = argsOf(soldLog)
      sold = {
        retailer: asAddress(String(a.retailer)),
        soldAt: toIso(a.soldAt as bigint),
        at: await ctx.timeOf(soldLog.blockNumber),
        txHash: soldLog.transactionHash,
      }
    }

    const related = batches.filter(
      (entry) =>
        entry.tokenId !== batch.tokenId &&
        entry.farmId === batch.farmId &&
        entry.harvestGroupId === batch.harvestGroupId,
    )
    const sameFarmOtherGroup = batches.filter(
      (entry) =>
        entry.tokenId !== batch.tokenId &&
        entry.farmId === batch.farmId &&
        entry.harvestGroupId !== batch.harvestGroupId,
    )
    const otherFarm = batches.filter(
      (entry) => entry.tokenId !== batch.tokenId && entry.farmId !== batch.farmId,
    )

    const report = await readArtifact(
      cidOf(incident.reportCID),
      chainHashHex(incident.reportHash),
      signal,
    )
    const recallArtifact = batch.recall
      ? await readArtifact(batch.recall.reasonCid, batch.recall.reasonHash, signal)
      : null

    return {
      incident: incidentRow ?? {
        incidentId,
        tokenId: batch.tokenId,
        batchCode: batch.batchCode,
        farmId: batch.farmId,
        harvestGroupId: batch.harvestGroupId,
        lifecycle: batch.lifecycle,
        batchRecalled: batch.recalled,
        reporter: asAddress(String(incident.reporter)),
        reportCid: cidOf(incident.reportCID),
        reportHash: chainHashHex(incident.reportHash),
        reportedAt: toIso(incident.timestamp as bigint),
        blockNumber: null,
        txHash: null,
        verifiedOnChain: true,
        recall: batch.recall,
      },
      batch,
      report,
      description: incidentDescription(report),
      ownership,
      readings,
      related,
      sameFarmOtherGroup,
      otherFarm,
      incidents: incidentRows,
      sold,
      roleLabels,
      recallArtifact,
      recallReasonText: recallReasonText(recallArtifact, batch.recall),
      metrics: metricsOf(ctx, started),
    }
  })
}

/** Danh sách ví theo vai trò (hasRole) + toàn bộ lịch sử cấp/thu hồi từ event. */
export async function readAdminRoles(
  signal: AbortSignal,
): Promise<{ holders: AdminRoleHolder[]; changes: AdminRoleChange[]; metrics: AdminReadMetrics }> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    const [granted, revoked] = await Promise.all([
      ctx.query('RoleGranted'),
      ctx.query('RoleRevoked'),
    ])

    const addresses = new Set<string>()
    for (const log of [...granted, ...revoked]) {
      const account = String(argsOf(log).account ?? '')
      if (isAddress(account)) addresses.add(asAddress(account))
    }

    const holders = await Promise.all(
      [...addresses].map(async (address) => {
        const active = await Promise.all(
          ROLES.map(
            (role) => ctx.call(ctx.contract.hasRole(roleHash(role), address)) as Promise<boolean>,
          ),
        )
        const roles = ROLES.filter((_, index) => active[index])
        const farmId = roles.includes('farmer')
          ? String(await ctx.call(ctx.contract.farmIdOf(address)))
          : ''
        return {
          address: asAddress(address),
          roles,
          farmId: farmId || null,
        } satisfies AdminRoleHolder
      }),
    )

    const changes: AdminRoleChange[] = []
    const push = async (log: EventLog | Log, action: AdminRoleChange['action']) => {
      const a = argsOf(log)
      const role = ROLE_BY_HASH.get(String(a.role).toLowerCase())
      const account = String(a.account ?? '')
      if (!role || !isAddress(account)) return
      changes.push({
        address: asAddress(account),
        role,
        action,
        at: await ctx.timeOf(log.blockNumber),
        blockNumber: log.blockNumber,
        logIndex: log.index,
        txHash: log.transactionHash,
      })
    }
    for (const log of granted) await push(log, 'granted')
    for (const log of revoked) await push(log, 'revoked')
    changes.sort((x, y) => y.blockNumber - x.blockNumber || y.logIndex - x.logIndex)

    const activeHolders = holders.filter((holder) => holder.roles.length > 0)
    const order = (holder: AdminRoleHolder) =>
      ROLES.findIndex((role) => holder.roles.includes(role))
    activeHolders.sort((x, y) => order(x) - order(y) || x.address.localeCompare(y.address))

    return { holders: activeHolders, changes, metrics: metricsOf(ctx, started) }
  })
}

/** Farmer + farmId đọc từ contract, kèm số lô đã tạo (event BatchCreated). */
export async function readAdminFarms(
  signal: AbortSignal,
): Promise<{ farms: AdminFarmRow[]; metrics: AdminReadMetrics }> {
  const started = performance.now()
  return withChain(signal, async (ctx) => {
    const farmerHash = roleHash('farmer')
    const [granted, revoked, assigned, created] = await Promise.all([
      ctx.query('RoleGranted', farmerHash),
      ctx.query('RoleRevoked', farmerHash),
      ctx.query('FarmerAssigned'),
      ctx.query('BatchCreated'),
    ])

    const addresses = new Set<string>()
    for (const log of [...granted, ...revoked, ...assigned]) {
      const account = String(argsOf(log).account ?? argsOf(log).farmer ?? '')
      if (isAddress(account)) addresses.add(asAddress(account))
    }

    const lastAssign = new Map<string, { at: string; txHash: string }>()
    for (const log of assigned) {
      const farmer = asAddress(String(argsOf(log).farmer))
      lastAssign.set(farmer, { at: await ctx.timeOf(log.blockNumber), txHash: log.transactionHash })
    }

    const batchCount = new Map<string, number>()
    for (const log of created) {
      const farmer = String(argsOf(log).farmer)
      if (isAddress(farmer))
        batchCount.set(asAddress(farmer), (batchCount.get(asAddress(farmer)) ?? 0) + 1)
    }

    const farms = await Promise.all(
      [...addresses].map(async (address) => {
        const [farmId, activeFarmer] = await Promise.all([
          ctx.call(ctx.contract.farmIdOf(address)) as Promise<string>,
          ctx.call(ctx.contract.hasRole(farmerHash, address)) as Promise<boolean>,
        ])
        const assignment = lastAssign.get(asAddress(address))
        return {
          address: asAddress(address),
          farmId: farmId || null,
          activeFarmer,
          batchCount: batchCount.get(asAddress(address)) ?? 0,
          assignedAt: assignment?.at ?? null,
          assignTx: assignment?.txHash ?? null,
        } satisfies AdminFarmRow
      }),
    )
    farms.sort(
      (x, y) =>
        (x.farmId ?? '').localeCompare(y.farmId ?? '') || x.address.localeCompare(y.address),
    )
    return { farms, metrics: metricsOf(ctx, started) }
  })
}
