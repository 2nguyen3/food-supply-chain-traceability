export type Role = 'admin' | 'farmer' | 'logistics' | 'retailer'
export type Lifecycle = 'Created' | 'InTransit' | 'Delivered' | 'Sold'
export interface Wallet {
  address: `0x${string}`
  chainId: number
  roles: Role[]
}
export interface Batch {
  code: string
  tokenId: string
  chainId: number
  contractAddress: `0x${string}`
  farmId: string
  groupId: string
  weightKg: 1000
  lifecycle: Lifecycle
  recalled: boolean
  expiration: string
  owner: `0x${string}`
  tokenUri?: string
}
export interface TransferRequest {
  id: string
  tokenId: string
  from: `0x${string}`
  to: `0x${string}`
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
}
export interface Incident {
  id: string
  tokenId: string
  reporter: `0x${string}`
  description: string
  evidenceCid?: string
  createdAt: string
}
export interface PrivateDocument {
  id: string
  tokenId: string
  name: string
  cid?: string
  sha256?: string
  grantedAddresses: `0x${string}`[]
}
export interface ChainEvent {
  transactionHash: `0x${string}`
  blockNumber: number
  timestamp?: string
  kind: string
  tokenId: string
}
export interface Reading {
  tokenId: string
  temperatureC: number
  location: string
  observedAt: string
  transactionHash?: `0x${string}`
}
export type TransactionStatus =
  'idle' | 'awaitingSignature' | 'pending' | 'confirmed' | 'rejected' | 'reverted' | 'error'
export interface ApiError {
  status?: number
  code: string
  message: string
  details?: unknown
}
export const BATCH_WEIGHT_KG = 1000 as const
export const LIFECYCLE_ORDER: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']
export function isExpired(batch: Pick<Batch, 'expiration'>, now = new Date()): boolean {
  return now.getTime() >= new Date(batch.expiration).getTime()
}
