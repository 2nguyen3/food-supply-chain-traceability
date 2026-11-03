import { Link } from 'react-router-dom'
import { Badge } from '../ui'
import type { Lifecycle, Wallet } from '../../domain/types'

export function Logo({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link className={`logo ${light ? 'light' : ''}`} to={to} aria-label="COCOMARK, về trang chủ">
      <img src="/brand/Primary.svg" width="36" height="36" alt="" />
      COCOMARK
    </Link>
  )
}
export function WalletChip({ wallet }: { wallet: Wallet | null }) {
  return (
    <span className="badge neutral wallet-chip">
      Ví:{' '}
      {wallet ? (
        <span className="mono">
          {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
        </span>
      ) : (
        'Chưa kết nối'
      )}
    </span>
  )
}
export function NetworkBadge({ chainId }: { chainId?: number }) {
  return (
    <Badge tone={chainId === 11155111 ? 'success' : 'warning'}>
      {chainId === 11155111 ? 'Sepolia' : 'Chưa xác nhận mạng'}
    </Badge>
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
