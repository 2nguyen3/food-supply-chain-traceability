import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui'
import { useToast } from '../ui/toast'
import type { Lifecycle, Wallet } from '../../domain/types'
import { DashboardIcon } from './DashboardIcon'

export function Logo({
  light = false,
  to = '/',
  scrollTop = false,
}: {
  light?: boolean
  to?: string
  scrollTop?: boolean
}) {
  return (
    <Link
      className={`logo ${light ? 'light' : ''}`}
      to={to}
      aria-label={scrollTop ? 'COCOMARK, lên đầu trang' : 'COCOMARK, về trang chủ'}
      onClick={
        scrollTop
          ? (event) => {
              event.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          : undefined
      }
    >
      <img src={light ? '/brand/Reverse.svg' : '/brand/Primary.svg'} width="36" height="36" alt="" />
      COCOMARK
    </Link>
  )
}
export function WalletChip({ wallet, label }: { wallet: Wallet | null; label?: string }) {
  const { showToast } = useToast()
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
            showToast('Không thể sao chép địa chỉ ví trên trình duyệt này', 'error')
            return
          }
          copy.then(
            () => {
              setCopyStatus('copied')
              showToast('Đã sao chép địa chỉ ví', 'success')
            },
            () => {
              setCopyStatus('error')
              showToast('Không thể sao chép địa chỉ ví trên trình duyệt này', 'error')
            },
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
