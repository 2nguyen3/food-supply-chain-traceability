import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from '../../../components/ui'
import type { Lifecycle } from '../../../domain/types'
import { BatchThumb } from '../components/BatchThumb'
import { FarmerOverviewIcon, type FarmerOverviewIconName } from '../components/FarmerOverviewIcon'
import { useFarmerSnapshot } from '../hooks/useFarmerSnapshot'
import { getFarmerOverviewKpis } from '../services/farmerOverviewService'
import type { FarmerSnapshot, TransferStatus } from '../types'
import '../styles/farmer-overview.css'

const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  Created: 'Đã tạo',
  InTransit: 'Đang vận chuyển',
  Delivered: 'Đã giao',
  Sold: 'Đã bán',
}

const TRANSFER_LABELS: Record<TransferStatus, string> = {
  pending: 'Đang chờ',
  accepted: 'Đã nhận',
  cancelled: 'Đã hủy',
  rejected: 'Từ chối',
}

const formatTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

function FarmerKpis({ snapshot }: { snapshot: FarmerSnapshot }) {
  const kpis = getFarmerOverviewKpis(snapshot)
  const cards: {
    label: string
    value: number
    hint: string
    icon: FarmerOverviewIconName
    tone: 'green' | 'brown' | 'orange' | 'cocoa'
  }[] = [
    { label: 'Lô đã tạo', value: kpis.created, hint: 'Mỗi lô 1.000 kg, 1 NFT', icon: 'box', tone: 'green' },
    { label: 'Đang sở hữu', value: kpis.owned, hint: 'NFT còn thuộc Farmer', icon: 'leaf', tone: 'brown' },
    { label: 'Chờ bàn giao', value: kpis.pending, hint: 'Yêu cầu đang pending', icon: 'route', tone: 'orange' },
    { label: 'Đã chuyển giao', value: kpis.transferred, hint: 'Logistics đã chấp nhận', icon: 'route', tone: 'cocoa' },
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

function FarmerRecentBatches({ snapshot }: { snapshot: FarmerSnapshot }) {
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
        <EmptyState title="Chưa có lô" description="Bạn chưa tạo lô nào. Bấm “Tạo lô NFT mới” để bắt đầu." />
      ) : (
        <div className="farmer-batch-grid">
          {batches.map((batch) => (
            <Link
              className="farmer-batch-card"
              to={`/farmer/batches/${encodeURIComponent(batch.code)}`}
              key={batch.tokenId}
              aria-label={`Xem lô ${batch.code}`}
            >
              <div className="farmer-batch-image">
                <BatchThumb metadataCid={batch.metadataCid} alt={`Ảnh của lô ${batch.code}`} />
              </div>
              <div className="farmer-batch-card-body">
                <div className="farmer-batch-card-title">
                  <strong>{batch.code}</strong>
                  <span className="mono">#{batch.tokenId}</span>
                </div>
                <p>
                  {batch.farmId} · {batch.harvestGroupId}
                </p>
                <span className={`farmer-lifecycle farmer-lifecycle-${batch.lifecycle.toLowerCase()}`}>
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

function FarmerRecentTransfers({ snapshot }: { snapshot: FarmerSnapshot }) {
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
            <li key={`${transfer.tokenId}-${transfer.id}`}>
              <span className="farmer-transfer-list-icon">
                <FarmerOverviewIcon name={transfer.status === 'accepted' ? 'check' : 'route'} />
              </span>
              <span>
                <strong className="mono">{transfer.batchCode}</strong>
                <small>{formatTime(transfer.requestedAt)}</small>
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
  const { result, loading, reload } = useFarmerSnapshot()
  const snapshot = result?.kind === 'ready' ? result.snapshot : null

  return (
    <div className="farmer-overview-page">
      <PageHeader
        title={snapshot ? `Xin chào, ${snapshot.farmerLabel}` : 'Tổng quan nông trại'}
        description={
          snapshot
            ? `Trang trại ${snapshot.farmId}. Tạo lô NFT mới và yêu cầu chuyển cho Logistics.`
            : 'Thông tin nông trại hiển thị sau khi xác định được farmId của Farmer.'
        }
        actions={
          <Link className="button farmer-create-action" to="/farmer/create">
            <FarmerOverviewIcon name="plus" /> Tạo lô NFT mới
          </Link>
        }
      />

      {loading ? (
        <Card className="farmer-overview-feedback">
          <LoadingState label="Đang tải tổng quan nông trại…" />
        </Card>
      ) : result?.kind === 'error' ? (
        <ErrorState
          title="Không thể đọc dữ liệu tổng quan"
          description={result.message}
          action={
            <button className="button" type="button" onClick={reload}>
              Thử lại
            </button>
          }
        />
      ) : result?.kind === 'unassigned' ? (
        <Card className="farmer-overview-feedback farmer-unassigned">
          <span className="farmer-feedback-icon">
            <FarmerOverviewIcon name="leaf" />
          </span>
          <h2>Ví này chưa được gán farmId</h2>
          <p>
            Admin cần gán mã nông trại (farmId) cho ví của bạn trên hợp đồng trước khi bạn có thể
            tạo lô. Hãy liên hệ Admin.
          </p>
        </Card>
      ) : result?.kind === 'noWallet' ? (
        <Card className="farmer-overview-feedback farmer-unassigned">
          <span className="farmer-feedback-icon">
            <FarmerOverviewIcon name="wallet" />
          </span>
          <h2>Cần đăng nhập bằng ví thật</h2>
          <p>
            Phiên xem giao diện không có dữ liệu trên blockchain. Hãy đăng xuất rồi kết nối MetaMask.
          </p>
        </Card>
      ) : snapshot ? (
        <>
          <FarmerKpis snapshot={snapshot} />
          <FarmerRecentBatches snapshot={snapshot} />
          <FarmerRecentTransfers snapshot={snapshot} />
        </>
      ) : null}
    </div>
  )
}
