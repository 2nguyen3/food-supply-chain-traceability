export interface PublicConfig {
  chainId: number
  publicRpcUrl?: string
  contractAddress?: `0x${string}`
  apiBaseUrl?: string
  ipfsGateway?: string
}
const raw = import.meta.env
export const config: PublicConfig = {
  chainId: Number(raw.VITE_CHAIN_ID || 11155111),
  publicRpcUrl: raw.VITE_PUBLIC_RPC_URL || undefined,
  contractAddress: raw.VITE_CONTRACT_ADDRESS || undefined,
  apiBaseUrl: raw.VITE_API_BASE_URL || undefined,
  ipfsGateway: raw.VITE_IPFS_GATEWAY || undefined,
}
export function validateProductionConfig(): string[] {
  const missing: string[] = []
  if (!config.publicRpcUrl) missing.push('VITE_PUBLIC_RPC_URL')
  if (!config.contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(config.contractAddress))
    missing.push('VITE_CONTRACT_ADDRESS')
  if (!config.apiBaseUrl) missing.push('VITE_API_BASE_URL')
  if (!config.ipfsGateway) missing.push('VITE_IPFS_GATEWAY')
  if (config.chainId !== 11155111) missing.push('VITE_CHAIN_ID (Sepolia: 11155111)')
  return missing
}
