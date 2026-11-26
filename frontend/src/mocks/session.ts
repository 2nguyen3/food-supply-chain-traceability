import { config } from '../config/env'
import type { Role, Wallet } from '../domain/types'
export interface Session {
  wallet: Wallet
  source: 'chain' | 'development-preview'
  /** Thời điểm phiên đăng nhập hết hạn (ms); chỉ có với phiên đăng nhập bằng ví thật. */
  expiresAt?: number
}
let preview: Session | null = null
export function getPreviewSession(): Session | null {
  return import.meta.env.DEV ? preview : null
}
export function setPreviewRole(role: Role | null): void {
  if (!import.meta.env.DEV) return
  preview = role
    ? {
        source: 'development-preview',
        wallet: {
          address: '0x0000000000000000000000000000000000000000',
          chainId: config.chainId,
          roles: [role],
        },
      }
    : null
  window.dispatchEvent(new Event('cocomark:session'))
}
