import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../../../components/ui'
import type { Lifecycle } from '../../../domain/types'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import type { FarmerOverviewBatch, PreviewFarmId } from '../mocks/farmerOverviewFixtures'
import { farmerOverviewReader, type FarmerOverviewResult } from '../services/farmerOverviewService'
import '../styles/farmer-batches.css'

type ReadState = { key: string; result: FarmerOverviewResult }
type StatusFilter = 'all' | Lifecycle | 'recalled'

const STATUS_LABELS: Record<Lifecycle, string> = {
  Created: 'Đã tạo',
  InTransit: 'Đang vận chuyển',
  Delivered: 'Đã giao',
  Sold: 'Đã bán',
}

function BatchStatus({ batch }: { batch: FarmerOverviewBatch }) {
  return (
    <span className={`farmer-batches-status farmer-batches-status-${batch.lifecycle.toLowerCase()}`}>
      {batch.lifecycle} · {STATUS_LABELS[batch.lifecycle]}
    </span>
  )
}

export function FarmerBatchesPage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [previewFarmId, setPreviewFarmId] = useState<PreviewFarmId | null>(() => {
    const farm = searchParams.get('previewFarm')
    return farm === 'FARM-B' ? 'FARM-B' : farm === 'none' ? null : 'FARM-A'
  })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [directCode, setDirectCode] = useState('')
  const [directError, setDirectError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [readState, setReadState] = useState<ReadState | null>(null)
  const preview = import.meta.env.DEV && session?.source === 'development-preview'
  const previewHost = preview ? document.getElementById('development-preview') : null
  const previewState = preview ? searchParams.get('previewState') : null
  const key = `${session?.wallet.address ?? 'none'}:${session?.source ?? 'none'}:${previewFarmId ?? 'none'}:${previewState ?? ''}:${attempt}`

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      farmerOverviewReader.read(session, preview ? previewFarmId : null, controller.signal).then(
        (result) => {
          if (controller.signal.aborted) return
          if (previewState === 'error') setReadState({ key, result: { kind: 'error' } })
          else if (previewState === 'empty' && result.kind === 'ready')
            setReadState({
              key,
              result: { ...result, snapshot: { ...result.snapshot, batches: [], transfers: [] } },
            })
          else setReadState({ key, result })
        },
        () => {
          if (!controller.signal.aborted) setReadState({ key, result: { kind: 'error' } })
        },
      )
    }, 220)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [session, preview, previewFarmId, previewState, key])

  const result = readState?.key === key ? readState.result : null
  const snapshot = result?.kind === 'ready' ? result.snapshot : null
  const search = query.trim().toLocaleLowerCase('vi')
  const batches = snapshot?.batches.filter((batch) => {
    const matchesCode = batch.code.toLocaleLowerCase('vi').includes(search)
    const matchesStatus = status === 'all' || (status !== 'recalled' && batch.lifecycle === status)
    return matchesCode && matchesStatus
  }) ?? []
  const detailPath = (code: string) =>
    `/farmer/batches/${encodeURIComponent(code)}${preview ? `?previewFarm=${previewFarmId ?? 'none'}` : ''}`

  function openBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = directCode.trim().toUpperCase()
    if (!code) {
      setDirectError('Nhập mã lô để mở hồ sơ chỉ đọc.')
      return
    }
    if (!snapshot?.batches.some((batch) => batch.code === code)) {
      setDirectError('Không tìm thấy mã lô trong phạm vi Farmer này.')
      return
    }
    setDirectError('')
    navigate(detailPath(code))
  }

  function retry() {
    if (previewState === 'error') {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('previewState')
        return next
      })
    } else setAttempt((current) => current + 1)
  }

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

      {previewHost && createPortal(
        <div className="farmer-batches-dev-field">
          <label htmlFor="farmer-batches-preview-farm">Xem trước nông trại (mô phỏng)</label>
          <select
            id="farmer-batches-preview-farm"
            value={previewFarmId ?? ''}
            onChange={(event) => setPreviewFarmId((event.target.value || null) as PreviewFarmId | null)}
          >
            <option value="FARM-A">Farmer A · FARM-A</option>
            <option value="FARM-B">Farmer B · FARM-B</option>
            <option value="">Chưa có farmId</option>
          </select>
          <small>Chỉ đổi dữ liệu mẫu, không đổi ví hoặc farmId thật.</small>
        </div>,
        previewHost,
      )}

      {!result && session ? (
        <Card className="farmer-batches-feedback"><LoadingState label="Đang tải danh sách lô…" /></Card>
      ) : result?.kind === 'error' ? (
        <ErrorState
          title="Không thể đọc danh sách lô"
          description={previewState === 'error'
            ? 'Đây là trạng thái lỗi mô phỏng để kiểm tra giao diện; không phải lỗi RPC thật.'
            : 'Nguồn dữ liệu hiện chưa khả dụng. Vui lòng thử lại.'}
          action={<button className="button" type="button" onClick={retry}>Thử lại</button>}
        />
      ) : result?.kind === 'unassigned' ? (
        <Card className="farmer-batches-unassigned">
          <EmptyState
            title="Chưa có liên kết farmId cho ví này"
            description="Chưa thể xác định các lô do Farmer này tạo. Cần dữ liệu định danh uploader/farmId từ hệ thống trước khi hiển thị danh sách thật."
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
                <option value="all">Tất cả trạng thái</option>
                <option value="Created">Created</option>
                <option value="InTransit">InTransit</option>
                <option value="Delivered">Delivered</option>
                <option value="Sold">Sold</option>
                <option value="recalled">Đã thu hồi</option>
              </select>
            </div>
            <div className="farmer-batches-count" aria-live="polite">
              <strong>{batches.length} lô</strong>
            </div>
            <form className="farmer-batches-open" onSubmit={openBatch}>
              <label htmlFor="farmer-batches-code">Mở lô theo mã (chỉ đọc)</label>
              <div>
                <input
                  id="farmer-batches-code"
                  value={directCode}
                  placeholder="Mở lô theo mã (chỉ đọc)"
                  onChange={(event) => { setDirectCode(event.target.value); setDirectError('') }}
                  aria-describedby={directError ? 'farmer-batches-code-error' : undefined}
                  aria-invalid={!!directError}
                />
                <button className="farmer-batches-open-button" type="submit">Mở</button>
              </div>
              {directError && <span id="farmer-batches-code-error" role="alert">{directError}</span>}
            </form>
          </div>

          {snapshot.batches.length === 0 ? (
            <EmptyState title="Chưa có lô" description="Farmer này chưa tạo lô nào trong dữ liệu hiện có." />
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
                    <tr key={batch.code}>
                      <td data-label="Mã lô">
                        <Link className="farmer-batches-code" to={detailPath(batch.code)}>
                          {batch.code}
                        </Link>
                        <span className="farmer-batches-subtext">1.000 kg · 1 NFT</span>
                      </td>
                      <td data-label="Token" className="farmer-batches-mono">#{batch.tokenId}</td>
                      <td data-label="Farm / Nhóm">
                        {batch.farmId}<span className="farmer-batches-subtext">{batch.harvestGroupId}</span>
                      </td>
                      <td data-label="Chủ sở hữu NFT">
                        <span className="farmer-batches-owner">
                          <FarmerOverviewIcon name="wallet" /> {batch.ownerLabel}
                        </span>
                        <span className="farmer-batches-subtext">Chưa có địa chỉ ví</span>
                      </td>
                      <td data-label="Trạng thái"><BatchStatus batch={batch} /></td>
                      <td data-label="Hạn dùng" className="farmer-batches-muted">Chưa có dữ liệu</td>
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
