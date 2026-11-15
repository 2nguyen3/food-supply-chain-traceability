import type { Lifecycle } from '../../domain/types'

export type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

export interface FarmerBatch {
  code: string
  tokenId: string
  farmId: string
  harvestGroupId: string
  lifecycle: Lifecycle
  recalled: boolean
  expired: boolean
  /** Hạn sử dụng (ISO). */
  expiryDate: string
  /** Chủ sở hữu NFT hiện tại, đọc từ hợp đồng. */
  owner: `0x${string}`
  ownedByMe: boolean
  ownerLabel: string
  /** CID của metadata.json (từ sự kiện BatchCreated). */
  metadataCid: string
  /** Yêu cầu bàn giao đang chờ (nếu có). */
  pending?: { requestId: string; to: `0x${string}`; toLabel: string }
}

export interface FarmerTransfer {
  /** requestId trên hợp đồng. */
  id: string
  tokenId: string
  batchCode: string
  to: `0x${string}`
  toLabel: string
  status: TransferStatus
  requestedAt: string
  closedAt?: string
}

export interface FarmerSnapshot {
  address: `0x${string}`
  farmId: string
  farmerLabel: string
  batches: FarmerBatch[]
  transfers: FarmerTransfer[]
}

export type FarmerOverviewResult =
  | { kind: 'ready'; snapshot: FarmerSnapshot }
  /** Ví có vai trò Farmer nhưng Admin chưa gán farmId. */
  | { kind: 'unassigned' }
  /** Phiên không phải ví thật (tài khoản xem giao diện khi dev): không có dữ liệu để đọc. */
  | { kind: 'noWallet' }
  | { kind: 'error'; message: string }
