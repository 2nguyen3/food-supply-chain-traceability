import type { Session } from '../../../mocks/session'
import type { FarmerOverviewResult, FarmerSnapshot } from '../types'
import { FarmerChainError, readFarmerSnapshot } from './farmerChain'

export type { FarmerOverviewResult }

export interface FarmerOverviewReader {
  read(session: Session, signal?: AbortSignal): Promise<FarmerOverviewResult>
}

/** Đọc dữ liệu Farmer từ hợp đồng theo ví đã đăng nhập; phiên xem giao diện (dev) không có dữ liệu thật. */
export const farmerOverviewReader: FarmerOverviewReader = {
  async read(session, signal) {
    if (signal?.aborted) throw new DOMException('Đã hủy', 'AbortError')
    if (session.source !== 'chain') return { kind: 'noWallet' }
    try {
      const result = await readFarmerSnapshot(session.wallet.address, signal)
      if (result === 'unassigned') return { kind: 'unassigned' }
      return { kind: 'ready', snapshot: result }
    } catch (error) {
      if (signal?.aborted) throw error
      return {
        kind: 'error',
        message: error instanceof FarmerChainError ? error.message : 'Không đọc được dữ liệu.',
      }
    }
  },
}

export function getFarmerOverviewKpis(snapshot: FarmerSnapshot) {
  const owned = snapshot.batches.filter((batch) => batch.ownedByMe)
  const pending = snapshot.transfers.filter((transfer) => transfer.status === 'pending')
  const accepted = new Set(
    snapshot.transfers.filter((transfer) => transfer.status === 'accepted').map((t) => t.tokenId),
  )
  return {
    created: snapshot.batches.length,
    owned: owned.length,
    pending: pending.length,
    transferred: accepted.size,
  }
}
