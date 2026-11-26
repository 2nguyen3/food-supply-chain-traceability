import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import type { Lifecycle } from '../../domain/types'
import { formatTime, LIFECYCLE_PILL, shortAddress } from './format'
import { useAdminChain } from './hooks/useAdminChain'
import { readAdminBatches } from './services/adminChain'
import './styles/batches.css'

type BatchFilter = 'all' | Lifecycle | 'recalled' | 'expired'

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

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 2.8 20h18.4L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 9v5M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function BatchesPage() {
  const { showToast } = useToast()
  const loadBatches = useCallback((signal: AbortSignal) => readAdminBatches(signal), [])
  const { state, reload } = useAdminChain(loadBatches)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<BatchFilter>('all')

  const term = query.trim().toLowerCase()
  const batches = state.kind === 'ready' ? state.data.batches : []
  const rows = batches.filter((row) => {
    const matchesTerm =
      !term ||
      `${row.batchCode} ${row.farmId} ${row.harvestGroupId} ${row.owner} ${row.tokenId}`
        .toLowerCase()
        .includes(term)
    const matchesStatus =
      status === 'all' ||
      (status === 'recalled'
        ? row.recalled
        : status === 'expired'
          ? row.expired
          : row.lifecycle === status)
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
        description="Danh sách toàn bộ lô đọc từ event BatchCreated; trạng thái, hết hạn và thu hồi đối chiếu getBatch/isExpired. Admin không xem được hóa đơn riêng nếu chưa được cấp quyền."
      />

      <section className="batches-card" aria-label="Danh sách lô hàng">
        <div className="batches-toolbar">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo mã lô, farmId, nhóm, ví…"
            aria-label="Tìm theo mã lô, farmId, nhóm hoặc ví"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as BatchFilter)}
            aria-label="Lọc theo trạng thái"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Created">Created · Đã tạo</option>
            <option value="InTransit">InTransit · Đang vận chuyển</option>
            <option value="Delivered">Delivered · Đã giao</option>
            <option value="Sold">Sold · Đã bán</option>
            <option value="expired">Đã hết hạn</option>
            <option value="recalled">Đã thu hồi</option>
          </select>
          <span className="batches-count">{rows.length} lô</span>
        </div>

        {state.kind === 'loading' && <LoadingState label="Đang đọc danh sách lô từ blockchain…" />}

        {state.kind === 'error' && (
          <ErrorState
            title="Không đọc được danh sách lô"
            description={state.message}
            action={
              <Button type="button" onClick={reload}>
                Thử lại
              </Button>
            }
          />
        )}

        {state.kind === 'ready' && (
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
                  <tr key={row.tokenId}>
                    <td>
                      <div className="batches-code">
                        <Link to={`/admin/batches/${row.batchCode}`}>{row.batchCode}</Link>
                        <span>
                          {row.quantityKg.toLocaleString('vi-VN')} kg · tạo{' '}
                          {row.createdAt ? formatTime(row.createdAt) : '—'}
                        </span>
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
                      <span className="batches-group">{row.harvestGroupId}</span>
                    </td>
                    <td>
                      <div className="batches-owner">
                        <span className="batches-owner-label">
                          <WalletIcon />
                          <span className="mono" title={row.owner}>
                            {shortAddress(row.owner)}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="batches-copy"
                          onClick={() => copyAddress(row.owner)}
                          aria-label={`Sao chép địa chỉ ${row.owner}`}
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
                        {row.expired && <span className="batch-status expired">Đã hết hạn</span>}
                        {row.recalled && (
                          <span className="batch-status recalled">
                            <AlertIcon />
                            Đã thu hồi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="batches-expiry">{formatTime(row.expiryDate)}</td>
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
        )}
      </section>

      {state.kind === 'ready' && (
        <p className="admin-metrics" role="status">
          Đọc từ chain: {batches.length} lô · {state.data.metrics.events} event ·{' '}
          {state.data.metrics.rpcCalls} RPC · {state.data.metrics.durationMs} ms
        </p>
      )}
    </div>
  )
}
