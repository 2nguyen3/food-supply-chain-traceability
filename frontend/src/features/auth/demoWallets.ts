import type { Role } from '../../domain/types'

export interface DemoWallet {
  address: `0x${string}`
  chainId: number
  roles: Role[]
}

export const DEMO_WALLETS: Record<string, DemoWallet> = {
  admin: {
    address: '0xAD00000000000000000000000000000000000001',
    chainId: 11155111,
    roles: ['admin'],
  },
  farmer: {
    address: '0xFA00000000000000000000000000000000000001',
    chainId: 11155111,
    roles: ['farmer'],
  },
  logistics: {
    address: '0x1000000000000000000000000000000000000001',
    chainId: 11155111,
    roles: ['logistics'],
  },
  retailer: {
    address: '0xBE00000000000000000000000000000000000001',
    chainId: 11155111,
    roles: ['retailer'],
  },
  none: {
    address: '0xEE00000000000000000000000000000000000001',
    chainId: 11155111,
    roles: [],
  },
}

export function getDemoWallet(key: string | null): DemoWallet | undefined {
  if (!import.meta.env.DEV || !key) return undefined
  return DEMO_WALLETS[key]
}
