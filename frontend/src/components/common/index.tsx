import { Link } from 'react-router-dom'
import { Badge } from '../ui'
import { useToast } from '../ui/toast'
import type { Lifecycle, Wallet } from '../../domain/types'

export function Logo({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link className={`logo ${light ? 'light' : ''}`} to={to} aria-label="COCOMARK, về trang chủ">
      <img src="/brand/Primary.svg" width="36" height="36" alt="" />
      COCOMARK
    </Link>
  )
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3 9.5h18M16.5 14.5h2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function WalletChip({ wallet, label }: { wallet: Wallet | null; label?: string }) {
  const { showToast } = useToast()

  if (!wallet) return <span className="wallet-pill">Ví: Chưa kết nối</span>

  const address = wallet.address
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      showToast('Đã sao chép địa chỉ ví', 'success')
    } catch {
      showToast('Không thể sao chép địa chỉ ví trên trình duyệt này', 'error')
    }
  }

  return (
    <span className="wallet-pill">
      <WalletIcon />
      {label && <span className="wallet-pill-label">{label}</span>}
      <span className="wallet-pill-address">{short}</span>
      <button
        type="button"
        className="wallet-pill-copy"
        onClick={copyAddress}
        aria-label="Sao chép địa chỉ ví"
        title="Sao chép địa chỉ ví"
      >
        <CopyIcon />
      </button>
    </span>
  )
}

export function NetworkBadge({ chainId }: { chainId?: number }) {
  const onSepolia = chainId === 11155111
  return (
    <span className={`network-pill${onSepolia ? '' : ' warning'}`}>
      <span className="network-dot" aria-hidden="true" />
      {onSepolia ? 'Sepolia testnet · 11155111' : 'Chưa xác nhận mạng'}
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
