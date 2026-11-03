import type {
  Batch,
  ChainEvent,
  Incident,
  Reading,
  Role,
  TransactionStatus,
  TransferRequest,
  Wallet,
} from '../domain/types'
export interface TransactionHandle {
  hash: `0x${string}`
  status: TransactionStatus
  waitForReceipt(
    signal?: AbortSignal,
  ): Promise<{ status: 'confirmed' | 'reverted'; blockNumber: number }>
}
export interface WalletConnector {
  connect(): Promise<Wallet>
  disconnect(): Promise<void>
  onAccountOrChainChanged(listener: () => void): () => void
}
export interface PublicChainReader {
  getBatch(tokenId: string, signal?: AbortSignal): Promise<Batch | null>
  getEvents(tokenId: string, signal?: AbortSignal): Promise<ChainEvent[]>
  getReadings(tokenId: string, signal?: AbortSignal): Promise<Reading[]>
  hasRole(address: `0x${string}`, role: Role, signal?: AbortSignal): Promise<boolean>
}
export interface SignedChainWriter {
  createBatch(
    input: Omit<Batch, 'tokenId' | 'owner' | 'lifecycle' | 'recalled'>,
  ): Promise<TransactionHandle>
  requestTransfer(tokenId: string, to: `0x${string}`): Promise<TransactionHandle>
  acceptTransfer(request: TransferRequest): Promise<TransactionHandle>
  markSold(tokenId: string): Promise<TransactionHandle>
  recallBatch(tokenId: string, reason: string, evidenceCid?: string): Promise<TransactionHandle>
  reportIncident?(input: Omit<Incident, 'id' | 'createdAt'>): Promise<TransactionHandle>
}
