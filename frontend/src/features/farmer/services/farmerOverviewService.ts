import type { Session } from '../../../mocks/session'
import {
  getFarmerOverviewFixture,
  type FarmerOverviewSnapshot,
  type PreviewFarmId,
} from '../mocks/farmerOverviewFixtures'

export type FarmerOverviewResult =
  | { kind: 'ready'; source: 'development-preview'; snapshot: FarmerOverviewSnapshot }
  | { kind: 'unassigned' }
  | { kind: 'error' }

export interface FarmerOverviewReader {
  read(
    session: Session,
    previewFarmId: PreviewFarmId | null,
    signal?: AbortSignal,
  ): Promise<FarmerOverviewResult>
}

export const farmerOverviewReader: FarmerOverviewReader = {
  async read(session, previewFarmId, signal) {
    if (signal?.aborted) throw new DOMException('Đã hủy', 'AbortError')
    if (session.source !== 'development-preview' || !import.meta.env.DEV || !previewFarmId) {
      // Chưa có contract ABI, farmId mapping hoặc indexer để lập danh sách từ ví production.
      return { kind: 'unassigned' }
    }
    return {
      kind: 'ready',
      source: 'development-preview',
      snapshot: getFarmerOverviewFixture(previewFarmId),
    }
  },
}

export function getFarmerOverviewKpis(snapshot: FarmerOverviewSnapshot) {
  const owned = snapshot.batches.filter((batch) => batch.ownerFarmId === snapshot.farmId)
  const pending = snapshot.transfers.filter((transfer) => transfer.status === 'pending')
  const acceptedCodes = new Set(
    snapshot.transfers
      .filter((transfer) => transfer.status === 'accepted')
      .map((transfer) => transfer.batchCode),
  )
  return {
    created: snapshot.batches.length,
    owned: owned.length,
    pending: pending.length,
    transferred: acceptedCodes.size,
  }
}
