import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { RetailerBatch } from './services/retailerChain'

export function RetailerNotice({ loading, error, reload }: { loading: boolean; error?: string; reload: () => void }) {
  if (loading) return <div className="retailer-card retailer-state" role="status">Đang đọc dữ liệu từ blockchain…</div>
  if (error) return <div className="retailer-card retailer-state" role="alert"><p>{error}</p><button className="retailer-button" onClick={reload}>Thử lại</button></div>
  return null
}

export function RetailerBadge({ batch }: { batch: RetailerBatch }) {
  const labels = { Created: 'Đã tạo', InTransit: 'Đang vận chuyển', Delivered: 'Đã giao', Sold: 'Đã bán' }
  return <span className={`retailer-badge retailer-badge-${batch.lifecycle.toLowerCase()}`}>{batch.lifecycle} · {labels[batch.lifecycle]}</span>
}

export function RetailerFlags({ batch }: { batch: RetailerBatch }) {
  return <span className="retailer-flags">{batch.recalled && <span className="retailer-badge retailer-badge-alert">Đã thu hồi</span>}{batch.expired && <span className="retailer-badge retailer-badge-alert">Đã hết hạn</span>}</span>
}

export function RetailerEmpty({ children }: { children: ReactNode }) {
  return <div className="retailer-card retailer-state">{children}</div>
}

export function RetailerBatchLink({ batch }: { batch: RetailerBatch }) {
  return <Link to={`/retailer/batches/${encodeURIComponent(batch.code)}`} className="retailer-batch-link">{batch.code}</Link>
}
