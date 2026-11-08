import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import type { Lifecycle } from '../../domain/types'
import { BATCH_ROWS, LIFECYCLE_PILL } from './batchFixtures'
import { useRecalls } from './incidentStore'
import './styles/batches.css'

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

export function BatchesPage() {
  const { showToast } = useToast()
  const recalls = useRecalls()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | Lifecycle | 'recalled'>('all')

  const term = query.trim().toLowerCase()
  const rows = BATCH_ROWS.filter((row) => {
    const recalled = !!recalls[row.code]
    const matchesTerm =
      !term ||
      `${row.code} ${row.farmId} ${row.groupId} ${row.ownerLabel}`.toLowerCase().includes(term)
    const matchesStatus =
      status === 'all' || (status === 'recalled' ? recalled : row.lifecycle === status)
    return matchesTerm && matchesStatus
  })

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address)
      showToast('Đã sao chép địa chỉ ví', 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  return (
    <div className="batches-page">
      <PageHeader
        title="Tất cả lô"
        description="Danh sách toàn bộ lô trên hệ thống. Admin không xem được hóa đơn riêng nếu chưa được cấp quyền."
      />

      <section className="batches-card" aria-label="Danh sách lô hàng">
        <div className="batches-toolbar">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo mã lô..."
            aria-label="Tìm theo mã lô"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as 'all' | Lifecycle | 'recalled')}
            aria-label="Lọc theo trạng thái"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Created">Created · Đã tạo</option>
            <option value="InTransit">InTransit · Đang vận chuyển</option>
            <option value="Delivered">Delivered · Đã giao</option>
            <option value="Sold">Sold · Đã bán</option>
            <option value="recalled">Đã thu hồi</option>
          </select>
          <span className="batches-count">{rows.length} lô</span>
        </div>

        <div className="batches-table-wrap">
          <table className="batches-table">
            <thead>
              <tr>
                <th>Mã lô</th>
                <th>Token</th>
                <th>Farm</th>
                <th>Nhóm</th>
                <th>Chủ sở hữu NFT</th>
                <th>Trạng thái</th>
                <th>Hạn dùng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code}>
                  <td>
                    <div className="batches-code">
                      <Link to={`/admin/batches/${row.code}`}>{row.code}</Link>
                      <span>{row.weightKg.toLocaleString('vi-VN')} kg · 1 NFT</span>
                    </div>
                  </td>
                  <td>
                    <span className="batches-token">#{row.tokenId}</span>
                  </td>
                  <td>
                    <div className="batches-farm">
                      <strong>{row.farmId}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="batches-group">{row.groupId}</span>
                  </td>
                  <td>
                    <div className="batches-owner">
                      <span className="batches-owner-label">
                        <WalletIcon />
                        {row.ownerLabel}
                      </span>
                      <span className="mono">{shortAddress(row.ownerAddress)}</span>
                      <button
                        type="button"
                        className="batches-copy"
                        onClick={() => copyAddress(row.ownerAddress)}
                        aria-label={`Sao chép địa chỉ ${row.ownerLabel}`}
                        title="Sao chép địa chỉ ví"
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="batches-status-cell">
                      <span className={`batch-status ${row.lifecycle.toLowerCase()}`}>
                        {LIFECYCLE_PILL[row.lifecycle]}
                      </span>
                      {recalls[row.code] && (
                        <span className="batch-status recalled">Đã thu hồi</span>
                      )}
                    </div>
                  </td>
                  <td className="batches-expiry">{row.expiration}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="batches-empty">
                    Không tìm thấy lô phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
