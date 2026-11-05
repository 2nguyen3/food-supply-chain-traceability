import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../../../components/ui'
import type { Lifecycle, TransferRequest } from '../../../domain/types'
import { FarmerOverviewIcon, type FarmerOverviewIconName } from '../components/FarmerOverviewIcon'
import type {
  FarmerOverviewSnapshot,
  PreviewFarmId,
} from '../mocks/farmerOverviewFixtures'
import {
  farmerOverviewReader,
  getFarmerOverviewKpis,
  type FarmerOverviewResult,
} from '../services/farmerOverviewService'
import '../styles/farmer-overview.css'

type ReadState = { key: string; result: FarmerOverviewResult }

const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  Created: 'Đã tạo',
  InTransit: 'Đang vận chuyển',
  Delivered: 'Đã giao',
  Sold: 'Đã bán',
}

const TRANSFER_LABELS: Record<TransferRequest['status'], string> = {
  pending: 'Đang chờ',
  accepted: 'Đã nhận',
  cancelled: 'Đã hủy',
  rejected: 'Từ chối',
}

function FarmerKpis({ snapshot }: { snapshot: FarmerOverviewSnapshot }) {
  const kpis = getFarmerOverviewKpis(snapshot)
  const cards: {
    label: string
    value: number
    hint: string
    icon: FarmerOverviewIconName
    tone: 'green' | 'brown' | 'orange' | 'cocoa'
  }[] = [
    {
      label: 'Lô đã tạo',
      value: kpis.created,
      hint: 'Mỗi lô 1.000 kg, 1 NFT',
      icon: 'box',
      tone: 'green',
    },
    {
      label: 'Đang sở hữu',
      value: kpis.owned,
      hint: 'NFT còn thuộc Farmer',
      icon: 'leaf',
      tone: 'brown',
    },
    {
      label: 'Chờ bàn giao',
      value: kpis.pending,
      hint: 'Yêu cầu đang pending',
      icon: 'route',
      tone: 'orange',
    },
    {
      label: 'Đã chuyển giao',
      value: kpis.transferred,
      hint: 'Logistics đã chấp nhận',
      icon: 'route',
      tone: 'cocoa',
    },
  ]
  return (
    <section className="farmer-kpis" aria-label="Chỉ số tổng quan">
      {cards.map((card) => (
        <Card className={`farmer-kpi farmer-kpi-${card.tone}`} key={card.label}>
          <span className="farmer-kpi-icon">
            <FarmerOverviewIcon name={card.icon} />
          </span>
          <div className="farmer-kpi-content">
            <h2>{card.label}</h2>
            <strong className="farmer-kpi-number">{card.value}</strong>
            <p>{card.hint}</p>
          </div>
        </Card>
      ))}
    </section>
  )
}

function FarmerRecentBatches({ snapshot }: { snapshot: FarmerOverviewSnapshot }) {
  const batches = snapshot.batches.slice(-4).reverse()
  return (
    <section className="farmer-recent-batches" aria-labelledby="farmer-recent-batches-title">
      <div className="farmer-section-head">
        <div>
          <h2 id="farmer-recent-batches-title">Lô gần đây</h2>
        </div>
        <Link to="/farmer/batches">
          Xem tất cả <FarmerOverviewIcon name="arrow" />
        </Link>
      </div>
      {batches.length === 0 ? (
        <EmptyState
          title="Chưa có lô"
          description="Chưa có lô nào được tạo trong phạm vi nông trại này."
        />
      ) : (
        <div className="farmer-batch-grid">
          {batches.map((batch) => (
            <Link
              className="farmer-batch-card"
              to={`/farmer/batches/${batch.code}`}
              key={batch.code}
              aria-label={`Xem lô ${batch.code}`}
            >
              <div className="farmer-batch-image">
                <img
                  src="/images/home/coconut-cluster.jpg"
                  alt="Ảnh dừa minh họa, không phải ảnh gốc của lô"
                  loading="lazy"
                />
                <span>Ảnh minh họa</span>
              </div>
              <div className="farmer-batch-card-body">
                <div className="farmer-batch-card-title">
                  <strong>{batch.code}</strong>
                  <span className="mono">#{batch.tokenId}</span>
                </div>
                <p>
                  {batch.farmId} · {batch.harvestGroupId}
                </p>
                <span
                  className={`farmer-lifecycle farmer-lifecycle-${batch.lifecycle.toLowerCase()}`}
                >
                  {batch.lifecycle} · {LIFECYCLE_LABELS[batch.lifecycle]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function FarmerRecentTransfers({ snapshot }: { snapshot: FarmerOverviewSnapshot }) {
  const transfers = snapshot.transfers.slice(0, 4)
  return (
    <Card className="farmer-overview-section farmer-recent-transfers">
      <div className="farmer-section-head">
        <div>
          <h2>Bàn giao gần đây</h2>
          <p>Yêu cầu chuyển lô từ Farmer đến Logistics.</p>
        </div>
        <Link to="/farmer/transfers">
          Xem tất cả <FarmerOverviewIcon name="arrow" />
        </Link>
      </div>
      {transfers.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu bàn giao"
          description="Lô vẫn giữ chủ sở hữu hiện tại cho đến khi bên nhận chấp nhận yêu cầu."
        />
      ) : (
        <ul className="farmer-transfer-list">
          {transfers.map((transfer) => (
            <li key={transfer.id}>
              <span className="farmer-transfer-list-icon">
                <FarmerOverviewIcon name={transfer.status === 'accepted' ? 'check' : 'route'} />
              </span>
              <span>
                <strong className="mono">{transfer.batchCode}</strong>
                <small>{transfer.requestedAt ?? 'Chưa có thời điểm mẫu'}</small>
              </span>
              <span className={`farmer-transfer-status farmer-transfer-${transfer.status}`}>
                {TRANSFER_LABELS[transfer.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function FarmerOverviewPage() {
  const { session } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [previewFarmId, setPreviewFarmId] = useState<PreviewFarmId | null>('FARM-A')
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

  const loading = !!session && readState?.key !== key
  const result = loading ? null : readState?.result
  const snapshot = result?.kind === 'ready' ? result.snapshot : null

  return (
    <div className="farmer-overview-page">
      <PageHeader
        title={snapshot ? `Xin chào, ${snapshot.farmerLabel}` : 'Tổng quan nông trại'}
        description={
          snapshot
            ? `Trang trại ${snapshot.farmId}. Tạo lô NFT mới và yêu cầu chuyển cho Logistics.`
            : 'Thông tin nông trại sẽ hiển thị sau khi xác định được farmId của Farmer.'
        }
        actions={
          <Link className="button farmer-create-action" to="/farmer/create">
            <FarmerOverviewIcon name="plus" /> Tạo lô NFT mới
          </Link>
        }
      />

      {previewHost &&
        createPortal(
          <div className="farmer-dev-field">
            <label htmlFor="farmer-preview-farm">Xem trước nông trại (mô phỏng)</label>
            <select
              id="farmer-preview-farm"
              value={previewFarmId ?? ''}
              onChange={(event) =>
                setPreviewFarmId((event.target.value || null) as PreviewFarmId | null)
              }
            >
              <option value="FARM-A">Farmer A · FARM-A</option>
              <option value="FARM-B">Farmer B · FARM-B</option>
              <option value="">Chưa có farmId</option>
            </select>
            <small>Chỉ đổi dữ liệu mẫu, không đổi ví hoặc farmId thật.</small>
          </div>,
          previewHost,
        )}

      {loading ? (
        <Card className="farmer-overview-feedback">
          <LoadingState label="Đang tải tổng quan nông trại…" />
        </Card>
      ) : result?.kind === 'error' ? (
        <ErrorState
          title="Không thể đọc dữ liệu tổng quan"
          description={
            previewState === 'error'
              ? 'Đây là trạng thái lỗi mô phỏng để kiểm tra giao diện; không phải lỗi RPC thật.'
              : 'Nguồn dữ liệu hiện chưa khả dụng. Vui lòng thử lại.'
          }
          action={
            <button
              className="button"
              type="button"
              onClick={() => {
                if (previewState === 'error') {
                  setSearchParams((current) => {
                    const next = new URLSearchParams(current)
                    next.delete('previewState')
                    return next
                  })
                } else {
                  setAttempt((current) => current + 1)
                }
              }}
            >
              Thử lại
            </button>
          }
        />
      ) : result?.kind === 'unassigned' ? (
        <Card className="farmer-overview-feedback farmer-unassigned">
          <span className="farmer-feedback-icon">
            <FarmerOverviewIcon name="leaf" />
          </span>
          <h2>Chưa có liên kết farmId cho ví này</h2>
          <p>
            Chưa thể xác định nông trại của ví từ nguồn dữ liệu hiện có. Khi tích hợp hợp đồng
            COCOMARK, trang này sẽ chỉ đọc các lô gắn với farmId được cấp cho Farmer.
          </p>
          {preview && <p>Dùng công cụ “Nông trại mẫu” để xem trước FARM-A hoặc FARM-B.</p>}
        </Card>
      ) : result?.kind === 'ready' ? (
        <>
          <FarmerKpis snapshot={result.snapshot} />
          <FarmerRecentBatches snapshot={result.snapshot} />
          <FarmerRecentTransfers snapshot={result.snapshot} />
        </>
      ) : null}
    </div>
  )
}
