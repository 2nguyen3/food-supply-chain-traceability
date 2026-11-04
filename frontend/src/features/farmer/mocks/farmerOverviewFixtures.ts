import type { Lifecycle, TransferRequest } from '../../../domain/types'

export type PreviewFarmId = 'FARM-A' | 'FARM-B'

export interface FarmerOverviewBatch {
  code: string
  tokenId: string
  farmId: PreviewFarmId
  harvestGroupId: string
  lifecycle: Lifecycle
  ownerFarmId?: PreviewFarmId
  ownerLabel: 'Retailer' | 'Farmer B'
}

export interface FarmerOverviewTransfer {
  id: string
  batchCode: string
  farmId: PreviewFarmId
  status: TransferRequest['status']
  recipient: 'Logistics'
  requestedAt?: string
}

export interface FarmerOverviewSnapshot {
  farmId: PreviewFarmId
  farmerLabel: string
  batches: FarmerOverviewBatch[]
  transfers: FarmerOverviewTransfer[]
}

const BATCHES: FarmerOverviewBatch[] = [
  {
    code: 'COCONUT-001',
    tokenId: '1',
    farmId: 'FARM-A',
    harvestGroupId: 'HG-A01',
    lifecycle: 'Sold',
    ownerLabel: 'Retailer',
  },
  {
    code: 'COCONUT-002',
    tokenId: '2',
    farmId: 'FARM-A',
    harvestGroupId: 'HG-A01',
    lifecycle: 'Sold',
    ownerLabel: 'Retailer',
  },
  {
    code: 'COCONUT-003',
    tokenId: '3',
    farmId: 'FARM-A',
    harvestGroupId: 'HG-A02',
    lifecycle: 'Delivered',
    ownerLabel: 'Retailer',
  },
  {
    code: 'COCONUT-004',
    tokenId: '4',
    farmId: 'FARM-B',
    harvestGroupId: 'HG-B01',
    lifecycle: 'Created',
    ownerFarmId: 'FARM-B',
    ownerLabel: 'Farmer B',
  },
]

// Seed 001–003 đã thuộc Retailer, nên các bước rời Farmer chỉ được biểu diễn là bàn giao đã nhận trong bản xem trước.
// Không có requestId, thời điểm hoặc giao dịch thật trong đặc tả; id dưới đây chỉ là khóa UI cục bộ.
const TRANSFERS: FarmerOverviewTransfer[] = [
  {
    id: 'preview-001-logistics',
    batchCode: 'COCONUT-001',
    farmId: 'FARM-A',
    status: 'accepted',
    recipient: 'Logistics',
  },
  {
    id: 'preview-002-logistics',
    batchCode: 'COCONUT-002',
    farmId: 'FARM-A',
    status: 'accepted',
    recipient: 'Logistics',
  },
  {
    id: 'preview-003-logistics',
    batchCode: 'COCONUT-003',
    farmId: 'FARM-A',
    status: 'accepted',
    recipient: 'Logistics',
  },
]

export function getFarmerOverviewFixture(farmId: PreviewFarmId): FarmerOverviewSnapshot {
  return {
    farmId,
    farmerLabel: farmId === 'FARM-A' ? 'Farmer A' : 'Farmer B',
    batches: BATCHES.filter((batch) => batch.farmId === farmId),
    transfers: TRANSFERS.filter((transfer) => transfer.farmId === farmId),
  }
}
