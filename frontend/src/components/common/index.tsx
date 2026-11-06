import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui'
import type { Lifecycle, Wallet } from '../../domain/types'
import { DashboardIcon } from './DashboardIcon'

export function Logo({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link className={`logo ${light ? 'light' : ''}`} to={to} aria-label="COCOMARK, về trang chủ">
      <img src="/brand/Primary.svg" width="36" height="36" alt="" />
      COCOMARK
    </Link>
  )
}
export function WalletChip({ wallet, label }: { wallet: Wallet | null; label?: string }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  useEffect(() => {
    if (copyStatus === 'idle') return
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 2000)
    return () => window.clearTimeout(timeout)
  }, [copyStatus])

  if (!wallet) return <span className="wallet-chip wallet-chip-empty">Chưa kết nối ví</span>

  const shortAddress = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
  return (
    <span className="wallet-chip">
      <DashboardIcon name="wallet" className="wallet-chip-icon" />
      {label && <span className="wallet-chip-label">{label}</span>}
      <span className="mono wallet-chip-address" title={wallet.address}>
        {shortAddress}
      </span>
      <button
        type="button"
        className="wallet-copy-button"
        title="Sao chép địa chỉ ví"
        aria-label="Sao chép địa chỉ ví"
        onClick={() => {
          const copy = navigator.clipboard?.writeText(wallet.address)
          if (!copy) {
            setCopyStatus('error')
            return
          }
          copy.then(
            () => setCopyStatus('copied'),
            () => setCopyStatus('error'),
          )
        }}
      >
        <DashboardIcon name={copyStatus === 'copied' ? 'check' : 'copy'} />
      </button>
      <span className="wallet-copy-status" aria-live="polite">
        {copyStatus === 'copied'
          ? 'Đã sao chép địa chỉ ví'
          : copyStatus === 'error'
            ? 'Không thể sao chép địa chỉ ví'
            : ''}
      </span>
    </span>
  )
}
export function NetworkBadge({ chainId }: { chainId?: number }) {
  return (
    <span
      className={`network-badge ${chainId === 11155111 ? 'network-sepolia' : 'network-unknown'}`}
    >
      <span className="network-dot" aria-hidden="true" />
      {chainId === 11155111
        ? 'Sepolia testnet · 11155111'
        : chainId === undefined
          ? 'Chưa xác nhận mạng'
          : `Sai mạng · ${chainId}`}
    </span>
  )
}
export function LifecycleBadge({ value }: { value: Lifecycle }) {
  const labels: Record<Lifecycle, string> = {
    Created: 'Đã tạo',
    InTransit: 'Đang vận chuyển',
    Delivered: 'Đã giao',
    Sold: 'Đã bán',
  }
  return <Badge>{labels[value]}</Badge>
}
export function RecallBadge({ recalled }: { recalled: boolean }) {
  return (
    <Badge tone={recalled ? 'danger' : 'success'}>{recalled ? 'Đã thu hồi' : 'Chưa thu hồi'}</Badge>
  )
}
export function ExpiryBadge({ expiration, now = new Date() }: { expiration: string; now?: Date }) {
  const expired = now.getTime() >= new Date(expiration).getTime()
  return <Badge tone={expired ? 'danger' : 'success'}>{expired ? 'Hết hạn' : 'Còn hạn'}</Badge>
}
