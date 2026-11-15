import { Contract, getAddress, isAddress, JsonRpcProvider, type EventLog } from 'ethers'
import { config } from '../../../config/env'
import abiFile from '../../../contracts/FoodTraceability.json'
import type { Lifecycle } from '../../../domain/types'
import { argsOf, makeLogQuery } from '../../../services/chainLogs'
import { roleHash } from '../../../services/roles'

const lifecycles: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']

export interface RetailerBatch {
  code: string
  tokenId: string
  farmId: string
  harvestGroupId: string
  lifecycle: Lifecycle
  recalled: boolean
  expired: boolean
  expiryDate: string
  owner: string
  pendingRequestId?: string
}

export interface IncomingTransfer {
  tokenId: string
  code: string
  requestId: string
  from: string
  to: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  requestedAt: string
  closedAt?: string
}

export interface RetailerIncident {
  id: string
  tokenId: string
  code: string
  cid: string
  hash: string
  at: string
  txHash: string
}

export interface RetailerSnapshot {
  batches: RetailerBatch[]
  incoming: IncomingTransfer[]
  incidents: RetailerIncident[]
}

export async function readRetailerSnapshot(address: string, signal?: AbortSignal): Promise<RetailerSnapshot> {
  if (!config.publicRpcUrl || !config.contractAddress || !isAddress(config.contractAddress))
    throw new Error('Thiếu cấu hình RPC hoặc địa chỉ hợp đồng.')
  const provider = new JsonRpcProvider(config.publicRpcUrl, undefined, { batchMaxCount: 1 })
  try {
    const network = await provider.getNetwork()
    if (network.chainId !== BigInt(config.chainId)) throw new Error('RPC đang kết nối sai mạng blockchain.')
    if ((await provider.getCode(config.contractAddress)) === '0x') throw new Error('Chưa có hợp đồng tại địa chỉ cấu hình.')
    const contract = new Contract(config.contractAddress, abiFile.abi, provider)
    if (!(await contract.hasRole(roleHash('retailer'), address))) throw new Error('Ví hiện tại không còn vai trò Retailer trên hợp đồng.')
    const latest = await provider.getBlockNumber()
    const logs = makeLogQuery(contract, config.deployBlock, latest, signal)
    const created = await logs('BatchCreated')
    const allIds = created.map((log) => argsOf(log).tokenId as bigint)
    const codeOf = new Map(created.map((log) => [String(argsOf(log).tokenId), String(argsOf(log).batchCode)]))
    const allBatches = await Promise.all(allIds.map(async (id) => {
      const [batch, owner, pending] = await Promise.all([
        contract.getBatch(id), contract.ownerOf(id) as Promise<string>, contract.getPendingTransfer(id),
      ])
      return {
        code: String(batch.batchCode), tokenId: id.toString(), farmId: String(batch.farmId),
        harvestGroupId: String(batch.harvestGroupId), lifecycle: lifecycles[Number(batch.lifecycle)] ?? 'Created',
        recalled: Boolean(batch.recalled), expired: Date.now() >= Number(batch.expiryDate) * 1000,
        expiryDate: new Date(Number(batch.expiryDate) * 1000).toISOString(), owner: getAddress(owner),
        pendingRequestId: pending.active ? String(pending.requestId) : undefined,
      } satisfies RetailerBatch
    }))
    const batches = allBatches.filter((batch) => batch.owner.toLowerCase() === address.toLowerCase())
    const timeCache = new Map<number, string>()
    const timeOf = async (blockNumber: number) => {
      if (!timeCache.has(blockNumber)) {
        const block = await provider.getBlock(blockNumber)
        timeCache.set(blockNumber, new Date(Number(block?.timestamp ?? 0) * 1000).toISOString())
      }
      return timeCache.get(blockNumber)!
    }
    const requested = await logs('TransferRequested', null, null, address)
    const closed = new Map<string, { status: IncomingTransfer['status']; at: string }>()
    for (const [event, status] of [
      ['TransferAccepted', 'accepted'], ['TransferRejected', 'rejected'], ['TransferCancelled', 'cancelled'],
    ] as const) {
      for (const log of await logs(event)) {
        const args = argsOf(log)
        closed.set(`${args.tokenId}:${args.requestId}`, { status, at: await timeOf((log as EventLog).blockNumber) })
      }
    }
    const incoming = await Promise.all(requested.map(async (log) => {
      const args = argsOf(log)
      const tokenId = String(args.tokenId)
      const requestId = String(args.requestId)
      const end = closed.get(`${tokenId}:${requestId}`)
      const active = allBatches.find((batch) => batch.tokenId === tokenId)?.pendingRequestId === requestId
      return {
        tokenId, code: codeOf.get(tokenId) ?? `#${tokenId}`, requestId,
        from: getAddress(String(args.from)), to: getAddress(String(args.to)),
        status: end?.status ?? (active ? 'pending' : 'cancelled'),
        requestedAt: await timeOf((log as EventLog).blockNumber), closedAt: end?.at,
      } satisfies IncomingTransfer
    }))
    incoming.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
    const incidentLogs = await logs('IncidentReported', null, null, address)
    const incidents = await Promise.all(incidentLogs.map(async (log) => {
      const args = argsOf(log)
      return {
        id: String(args.incidentId), tokenId: String(args.tokenId), code: codeOf.get(String(args.tokenId)) ?? `#${args.tokenId}`,
        cid: String(args.reportCID), hash: String(args.reportHash),
        at: await timeOf((log as EventLog).blockNumber), txHash: log.transactionHash,
      } satisfies RetailerIncident
    }))
    incidents.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    return { batches, incoming, incidents }
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof Error && /^(Thiếu cấu hình|RPC đang|Chưa có hợp đồng|Ví hiện tại)/.test(error.message)) throw error
    throw new Error('Không đọc được dữ liệu Retailer từ blockchain. Kiểm tra RPC và thử lại.')
  } finally {
    provider.destroy()
  }
}
