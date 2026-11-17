import { Contract, getAddress, isAddress, JsonRpcProvider, type EventLog } from 'ethers'
import { config } from '../../../config/env'
import abiFile from '../../../contracts/FoodTraceability.json'
import type { Lifecycle } from '../../../domain/types'
import { argsOf, makeLogQuery } from '../../../services/chainLogs'
import { roleHash } from '../../../services/roles'
import { ipfsFileUrl } from '../../public/services/publicChainReader'
import type { FarmerBatch, FarmerSnapshot, FarmerTransfer, TransferStatus } from '../types'

const LIFECYCLES: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']

export class FarmerChainError extends Error {}

function openContract() {
  if (!config.publicRpcUrl || !config.contractAddress || !isAddress(config.contractAddress))
    throw new FarmerChainError('Thiếu cấu hình VITE_PUBLIC_RPC_URL hoặc VITE_CONTRACT_ADDRESS.')
  const provider = new JsonRpcProvider(config.publicRpcUrl, undefined, { batchMaxCount: 1 })
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

/** Nhãn "Vai trò · 0x1234…abcd" của một ví theo hợp đồng; ví không có vai trò thì chỉ có địa chỉ rút gọn. */
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

/** farmId do Admin gán cho ví; chuỗi rỗng nghĩa là chưa được gán. */
export async function readFarmId(address: string): Promise<string> {
  const { provider, contract } = openContract()
  try {
    return (await contract.farmIdOf(address)) as string
  } finally {
    provider.destroy()
  }
}

/** Mã lô đã dùng trên blockchain chưa (so sánh đúng chữ hoa/thường như hợp đồng). */
export async function batchCodeTaken(code: string): Promise<boolean> {
  const { provider, contract } = openContract()
  try {
    return ((await contract.getTokenIdByCode(code)) as bigint) > 0n
  } finally {
    provider.destroy()
  }
}

/** Toàn bộ dữ liệu của Farmer, đọc trực tiếp từ hợp đồng (không dùng cơ sở dữ liệu). */
export async function readFarmerSnapshot(
  address: `0x${string}`,
  signal?: AbortSignal,
): Promise<FarmerSnapshot | 'unassigned'> {
  const { provider, contract } = openContract()
  try {
    const farmId = (await contract.farmIdOf(address)) as string
    if (!farmId) return 'unassigned'
    const latest = await provider.getBlockNumber()
    const logs = makeLogQuery(contract, config.deployBlock, latest, signal)
    const label = makeLabeler(contract, address)

    const created = await logs('BatchCreated', null, address)
    const tokenIds = created.map((log) => argsOf(log).tokenId as bigint)

    const batches: FarmerBatch[] = await Promise.all(
      created.map(async (log) => {
        const a = argsOf(log)
        const tokenId = a.tokenId as bigint
        const [info, owner, pending] = await Promise.all([
          contract.getBatch(tokenId),
          contract.ownerOf(tokenId) as Promise<string>,
          contract.getPendingTransfer(tokenId),
        ])
        const ownerAddress = getAddress(owner) as `0x${string}`
        return {
          code: info.batchCode as string,
          tokenId: tokenId.toString(),
          farmId: info.farmId as string,
          harvestGroupId: info.harvestGroupId as string,
          lifecycle: LIFECYCLES[Number(info.lifecycle)] ?? 'Created',
          recalled: Boolean(info.recalled),
          expired: Date.now() >= Number(info.expiryDate) * 1000,
          expiryDate: new Date(Number(info.expiryDate) * 1000).toISOString(),
          owner: ownerAddress,
          ownedByMe: ownerAddress.toLowerCase() === address.toLowerCase(),
          ownerLabel: await label(ownerAddress),
          metadataCid: a.metadataCID as string,
          pending: pending.active
            ? {
                requestId: (pending.requestId as bigint).toString(),
                to: getAddress(pending.to) as `0x${string}`,
                toLabel: await label(pending.to),
              }
            : undefined,
        }
      }),
    )
    batches.sort((x, y) => Number(x.tokenId) - Number(y.tokenId))
    const codeOf = new Map(batches.map((batch) => [batch.tokenId, batch.code]))

    // Lịch sử yêu cầu bàn giao: yêu cầu do ví này gửi, đối chiếu với các sự kiện đóng yêu cầu
    const blockTimes = new Map<number, string>()
    const timeOf = async (blockNumber: number) => {
      if (!blockTimes.has(blockNumber)) {
        const block = await provider.getBlock(blockNumber)
        blockTimes.set(blockNumber, new Date((block?.timestamp ?? 0) * 1000).toISOString())
      }
      return blockTimes.get(blockNumber)!
    }
    const requested = await logs('TransferRequested', null, address)
    const closed = new Map<string, { status: TransferStatus; at: string }>()
    if (tokenIds.length) {
      const closers: [string, TransferStatus][] = [
        ['TransferAccepted', 'accepted'],
        ['TransferRejected', 'rejected'],
        ['TransferCancelled', 'cancelled'],
      ]
      for (const [event, status] of closers) {
        for (const log of await logs(event, tokenIds)) {
          const a = argsOf(log)
          closed.set(`${a.tokenId}:${a.requestId}`, { status, at: await timeOf((log as EventLog).blockNumber) })
        }
      }
    }
    const transfers: FarmerTransfer[] = await Promise.all(
      requested.map(async (log) => {
        const a = argsOf(log)
        const tokenId = (a.tokenId as bigint).toString()
        const requestId = (a.requestId as bigint).toString()
        const end = closed.get(`${tokenId}:${requestId}`)
        const stillActive = batches.find((b) => b.tokenId === tokenId)?.pending?.requestId === requestId
        return {
          id: requestId,
          tokenId,
          batchCode: codeOf.get(tokenId) ?? `#${tokenId}`,
          to: getAddress(a.to as string) as `0x${string}`,
          toLabel: await label(a.to as string),
          status: end?.status ?? (stillActive ? 'pending' : 'cancelled'),
          requestedAt: await timeOf((log as EventLog).blockNumber),
          closedAt: end?.at,
        } satisfies FarmerTransfer
      }),
    )
    transfers.sort((x, y) => Date.parse(y.requestedAt) - Date.parse(x.requestedAt) || Number(y.id) - Number(x.id))

    return { address, farmId, farmerLabel: `Farmer · ${shortAddress(address)}`, batches, transfers }
  } catch (error) {
    if (error instanceof FarmerChainError) throw error
    if (signal?.aborted) throw error
    throw new FarmerChainError('Không đọc được dữ liệu từ blockchain. Kiểm tra mạng và thử lại.')
  } finally {
    provider.destroy()
  }
}

const imageCache = new Map<string, Promise<string | null>>()

/** Ảnh của lô theo metadata (dùng làm ảnh thu nhỏ trong danh sách của chính Farmer, không xác minh hash). */
export function loadBatchImage(metadataCid: string): Promise<string | null> {
  if (!imageCache.has(metadataCid)) {
    imageCache.set(
      metadataCid,
      (async () => {
        try {
          const response = await fetch(ipfsFileUrl(metadataCid), { signal: AbortSignal.timeout(10000) })
          if (!response.ok) return null
          const meta = (await response.json()) as { image?: unknown }
          return typeof meta.image === 'string' && meta.image.startsWith('ipfs://')
            ? ipfsFileUrl(meta.image.slice('ipfs://'.length))
            : null
        } catch {
          return null
        }
      })(),
    )
  }
  const pending = imageCache.get(metadataCid)!
  // không ghi nhớ kết quả thất bại: lần mở sau thử tải lại
  void pending.then((url) => {
    if (!url) imageCache.delete(metadataCid)
  })
  return pending
}
