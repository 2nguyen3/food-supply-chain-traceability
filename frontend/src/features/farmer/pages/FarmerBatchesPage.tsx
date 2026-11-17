import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../../../components/ui'
import type { Lifecycle } from '../../../domain/types'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import { useFarmerSnapshot } from '../hooks/useFarmerSnapshot'
import type { FarmerBatch } from '../types'
import '../styles/farmer-batches.css'

type StatusFilter = 'all' | Lifecycle | 'recalled' | 'expired'

const STATUS_LABELS: Record<Lifecycle, string> = {
  Created: 'Đã tạo',
  InTransit: 'Đang vận chuyển',
  Delivered: 'Đã giao',
  Sold: 'Đã bán',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

function BatchStatus({ batch }: { batch: FarmerBatch }) {
  return (
    <>
      <span className={`farmer-batches-status farmer-batches-status-${batch.lifecycle.toLowerCase()}`}>
        {batch.lifecycle} · {STATUS_LABELS[batch.lifecycle]}
      </span>
      {batch.expired && <span className="farmer-batches-subtext">Hết hạn</span>}
      {batch.recalled && <span className="farmer-batches-subtext">Đã thu hồi</span>}
    </>
  )
}

export function FarmerBatchesPage() {
  const { result, loading, reload } = useFarmerSnapshot()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const snapshot = result?.kind === 'ready' ? result.snapshot : null
  const search = query.trim().toLocaleLowerCase('vi')
  const batches =
    snapshot?.batches.filter((batch) => {
      const matchesCode = batch.code.toLocaleLowerCase('vi').includes(search)
      const matchesStatus =
        status === 'all' ||
        (status === 'recalled' ? batch.recalled : status === 'expired' ? batch.expired : batch.lifecycle === status)
      return matchesCode && matchesStatus
    }) ?? []
  const detailPath = (code: string) => `/farmer/batches/${encodeURIComponent(code)}`

  return (
    <div className="farmer-batches-page">
      <PageHeader
        title="Lô của tôi"
        description="Các lô bạn đã tạo. Chủ sở hữu NFT có thể đã chuyển sang Logistics hoặc Retailer."
        actions={
          <Link className="button farmer-batches-create" to="/farmer/create">
            <FarmerOverviewIcon name="plus" /> Tạo lô NFT
          </Link>
        }
      />

      {loading ? (
        <Card className="farmer-batches-feedback">
          <LoadingState label="Đang tải danh sách lô…" />
        </Card>
      ) : result?.kind === 'error' ? (
        <ErrorState
          title="Không thể đọc danh sách lô"
          description={result.message}
          action={
            <button className="button" type="button" onClick={reload}>
              Thử lại
            </button>
          }
        />
      ) : result?.kind === 'unassigned' ? (
        <Card className="farmer-batches-unassigned">
          <EmptyState
            title="Ví này chưa được gán farmId"
            description="Admin cần gán farmId cho ví của bạn trên hợp đồng trước khi bạn có thể tạo lô."
          />
        </Card>
      ) : result?.kind === 'noWallet' ? (
        <Card className="farmer-batches-unassigned">
          <EmptyState
            title="Cần đăng nhập bằng ví thật"
            description="Phiên xem giao diện không có dữ liệu trên blockchain. Hãy đăng xuất rồi kết nối MetaMask."
          />
        </Card>
      ) : snapshot ? (
        <Card className="farmer-batches-list">
          <div className="farmer-batches-toolbar">
            <div className="farmer-batches-field">
              <label htmlFor="farmer-batches-search">Tìm theo mã lô</label>
              <input
                id="farmer-batches-search"
                type="search"
                placeholder="Tìm theo mã lô…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="farmer-batches-field">
              <label htmlFor="farmer-batches-status">Lọc trạng thái</label>
              <select
                id="farmer-batches-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
              >
                <option value="all">Tất cả</option>
                {(Object.keys(STATUS_LABELS) as Lifecycle[]).map((lifecycle) => (
                  <option key={lifecycle} value={lifecycle}>
                    {STATUS_LABELS[lifecycle]}
                  </option>
                ))}
                <option value="expired">Hết hạn</option>
                <option value="recalled">Đã thu hồi</option>
              </select>
            </div>
            <div className="farmer-batches-count" aria-live="polite">
              <strong>{batches.length} lô</strong>
            </div>
          </div>

          {snapshot.batches.length === 0 ? (
            <EmptyState title="Chưa có lô" description="Bạn chưa tạo lô nào. Bấm “Tạo lô NFT” để bắt đầu." />
          ) : batches.length === 0 ? (
            <div className="farmer-batches-no-results" role="status">
              <span className="farmer-batches-no-results-icon" aria-hidden="true">
                <FarmerOverviewIcon name="box" />
              </span>
              <h2>Không có lô phù hợp</h2>
              <p>Thử đổi bộ lọc hoặc tạo lô mới.</p>
            </div>
          ) : (
            <div className="farmer-batches-table-wrap">
              <table className="farmer-batches-table">
                <thead>
                  <tr>
                    <th scope="col">Mã lô</th>
                    <th scope="col">Token</th>
                    <th scope="col">Farm / Nhóm</th>
                    <th scope="col">Chủ sở hữu NFT</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Hạn dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.tokenId}>
                      <td data-label="Mã lô">
                        <Link className="farmer-batches-code" to={detailPath(batch.code)}>
                          {batch.code}
                        </Link>
                        <span className="farmer-batches-subtext">1.000 kg · 1 NFT</span>
                      </td>
                      <td data-label="Token" className="farmer-batches-mono">
                        #{batch.tokenId}
                      </td>
                      <td data-label="Farm / Nhóm">
                        {batch.farmId}
                        <span className="farmer-batches-subtext">{batch.harvestGroupId}</span>
                      </td>
                      <td data-label="Chủ sở hữu NFT">
                        <span className="farmer-batches-owner">
                          <FarmerOverviewIcon name="wallet" /> {batch.ownerLabel}
                        </span>
                        {!batch.ownedByMe && (
                          <span className="farmer-batches-subtext">Đã chuyển quyền sở hữu</span>
                        )}
                      </td>
                      <td data-label="Trạng thái">
                        <BatchStatus batch={batch} />
                      </td>
                      <td data-label="Hạn dùng" className="farmer-batches-muted">
                        {formatDate(batch.expiryDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  )
}
