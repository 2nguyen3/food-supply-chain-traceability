import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { Button, ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { config, networkName } from '../../config/env'
import type { Lifecycle, Role } from '../../domain/types'
import { ExplorerLink } from '../public/components/ExplorerLink'
import {
  formatDate,
  formatTime,
  LIFECYCLE_LABELS,
  LIFECYCLE_PILL,
  shortAddress,
  shortHash,
} from './format'
import { useAdminChain } from './hooks/useAdminChain'
import {
  readAdminBatchDetail,
  type AdminBatchDetail,
  type AdminBatchRow,
  type AdminIncidentRow,
  type AdminOwnershipStep,
  type AdminReading,
} from './services/adminChain'
import { TemperatureChart, type ChartReading } from './TemperatureChart'
import './styles/batches.css'

type TabId = 'overview' | 'public' | 'temperature' | 'journey' | 'qr'

const STEPS: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DEFAULT_TEMP_MIN = 8
const DEFAULT_TEMP_MAX = 15

const ROLE_NAMES: Record<Role, string> = {
  admin: 'Admin',
  farmer: 'Farmer',
  logistics: 'Logistics',
  retailer: 'Retailer',
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AlertIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 11v6M12 7.5h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 4h6v6M20 4l-8 8M9 5H5v14h14v-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M4 18v2h16v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 21V4m0 0h11.5l-2 3.5 2 3.5H5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m6 18.5 11.5-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function LeafIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 4c-8 0-14 3.5-14 10a6 6 0 0 0 6 6c6.5 0 8-6 8-16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M5 20c2.5-5 6-8 11-10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h11v10H3V6Zm11 3h4l3 3v4h-7V9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function ThermometerIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 14.5V6a2 2 0 1 1 4 0v8.5a4.5 4.5 0 1 1-4 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 9v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function StoreIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9V5h16v4M3 9h18l-1.5 3H4.5L3 9Zm1.5 3v7h15v-7M9 19v-4h6v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path
        d="M14 3v5h5M9 13h6M9 17h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function RouteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.5 18H14a4 4 0 0 0 0-8H9a3.5 3.5 0 0 1 0-7h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function QrIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3h-3z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function CopyButton({ text, message }: { text: string; message: string }) {
  const { showToast } = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  return (
    <button
      type="button"
      className="batch-copy"
      onClick={copy}
      aria-label={message}
      title={message}
    >
      <CopyIcon />
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="batch-field">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

function partyText(address: string, labels: Record<string, Role[]>): string {
  if (address === ZERO_ADDRESS) return 'Hệ thống'
  const roles = labels[address] ?? []
  const role = roles.length ? `${roles.map((item) => ROLE_NAMES[item]).join(' / ')} · ` : ''
  return `${role}${shortAddress(address)}`
}

type JourneyKind = 'mint' | 'transfer' | 'reading' | 'sold' | 'incident' | 'recall'

interface JourneyItem {
  id: string
  kind: JourneyKind
  title: string
  description: string
  time: string
  txHash: string
}

function journeyOf(
  ownership: AdminOwnershipStep[],
  readings: AdminReading[],
  detail: AdminBatchDetail,
  batchIncidents: AdminIncidentRow[],
): JourneyItem[] {
  const items: JourneyItem[] = []
  const labels = detail.roleLabels
  for (const step of ownership) {
    items.push({
      id: `transfer-${step.txHash}`,
      kind: step.kind === 'mint' ? 'mint' : 'transfer',
      title: step.kind === 'mint' ? 'Mint NFT' : 'Bàn giao',
      description: `${partyText(step.from, labels)} → ${partyText(step.to, labels)}`,
      time: step.at,
      txHash: step.txHash,
    })
  }
  for (const reading of readings) {
    items.push({
      id: `reading-${reading.readingId}`,
      kind: 'reading',
      title: 'Ghi nhận nhiệt độ',
      description: `${reading.temperatureC.toFixed(2)}°C tại ${reading.location} · quan sát ${formatTime(reading.observedAt)}`,
      time: reading.at,
      txHash: reading.txHash,
    })
  }
  if (detail.sold) {
    items.push({
      id: `sold-${detail.sold.txHash}`,
      kind: 'sold',
      title: 'Bán lô',
      description: `${partyText(detail.sold.retailer, labels)} đã bán lô.`,
      time: detail.sold.at,
      txHash: detail.sold.txHash,
    })
  }
  for (const incident of batchIncidents) {
    if (!incident.txHash) continue
    items.push({
      id: `incident-${incident.incidentId}`,
      kind: 'incident',
      title: 'Báo cáo sự cố',
      description: `${partyText(incident.reporter, labels)} báo cáo sự cố #${incident.incidentId}.`,
      time: incident.reportedAt,
      txHash: incident.txHash,
    })
  }
  if (detail.batch.recall) {
    items.push({
      id: `recall-${detail.batch.recall.txHash}`,
      kind: 'recall',
      title: 'Thu hồi lô',
      description: `${partyText(detail.batch.recall.admin, labels)} thu hồi theo sự cố #${detail.batch.recall.incidentId}.`,
      time: detail.batch.recall.at,
      txHash: detail.batch.recall.txHash,
    })
  }
  items.sort((x, y) => Date.parse(x.time) - Date.parse(y.time))
  return items
}

function verifyText(verified: 'match' | 'mismatch' | 'unavailable'): string {
  if (verified === 'match') return 'SHA-256 khớp hash trên chain'
  if (verified === 'mismatch') return 'SHA-256 KHÔNG khớp hash trên chain'
  return 'Chưa tải được tệp để đối chiếu'
}

export function BatchDetailPage() {
  const { code = '' } = useParams()
  const { showToast } = useToast()
  const loadDetail = useCallback(
    (signal: AbortSignal) => readAdminBatchDetail(code, signal),
    [code],
  )
  const { state, reload } = useAdminChain(loadDetail)
  const [tab, setTab] = useState<TabId>('overview')
  const qrRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  const detail = state.kind === 'ready' ? state.data : null
  const batch: AdminBatchRow | null = detail?.batch ?? null
  const batchIncidents = useMemo(
    () => (detail?.incidents ?? []).filter((row) => row.tokenId === detail?.batch.tokenId),
    [detail],
  )
  const readings = useMemo(() => detail?.readings ?? [], [detail])
  const tempMin = detail?.tempMin ?? DEFAULT_TEMP_MIN
  const tempMax = detail?.tempMax ?? DEFAULT_TEMP_MAX
  const chartReadings: ChartReading[] = useMemo(
    () =>
      readings.map((reading) => ({
        id: reading.readingId,
        temperatureC: reading.temperatureC,
        over: reading.temperatureC < tempMin || reading.temperatureC > tempMax,
      })),
    [readings, tempMin, tempMax],
  )
  const journey = useMemo(
    () => (detail && batch ? journeyOf(detail.ownership, readings, detail, batchIncidents) : []),
    [detail, batch, readings, batchIncidents],
  )

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="batches-page">
        <LoadingState label={`Đang đọc lô ${code} từ blockchain…`} />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="batches-page">
        <PageHeader
          title={
            state.message.includes('Không tìm thấy') ? 'Không tìm thấy lô' : 'Không đọc được lô'
          }
          crumbs={[{ label: 'Lô hàng', to: '/admin/batches' }]}
        />
        <ErrorState
          title="Không mở được chi tiết lô"
          description={state.message}
          action={
            <div className="batch-error-actions">
              <Button type="button" onClick={reload}>
                Thử lại
              </Button>
              <Link className="button secondary" to="/admin/batches">
                Quay lại danh sách lô
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  if (!detail || !batch) return null

  const currentIndex = STEPS.indexOf(batch.lifecycle)
  const qrUrl = `${window.location.origin}/trace/${config.chainId}/${config.contractAddress}/${batch.tokenId}`
  const referenceIncident =
    batchIncidents[0] ?? detail.incidents[detail.incidents.length - 1] ?? null
  const overReadings = chartReadings.filter((reading) => reading.over)
  const maxTemp = readings.length
    ? Math.max(...readings.map((reading) => reading.temperatureC))
    : null

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'Tổng quan', icon: <BoxIcon /> },
    { id: 'public', label: 'Tài liệu công khai', icon: <FileIcon /> },
    { id: 'temperature', label: 'Nhiệt độ', icon: <ThermometerIcon /> },
    { id: 'journey', label: 'Hành trình & NFT', icon: <RouteIcon /> },
    { id: 'qr', label: 'QR', icon: <QrIcon /> },
  ]

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) {
      showToast('Không thể tạo ảnh QR', 'error')
      return
    }
    const fileName = `${batch!.batchCode}-qr.png`
    const save = (href: string) => {
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        save(canvas.toDataURL('image/png'))
        return
      }
      const url = URL.createObjectURL(blob)
      save(url)
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast('Đã tải ảnh QR', 'success')
    }, 'image/png')
  }

  function scrollTabs(direction: number) {
    tabsRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' })
  }

  function recallAction() {
    if (batch!.recall)
      return (
        <span className="batch-action batch-action-done">
          <CheckIcon />
          Đã thu hồi ·{' '}
          <ExplorerLink kind="tx" value={batch!.recall.txHash}>
            {shortHash(batch!.recall.txHash)}
          </ExplorerLink>
        </span>
      )
    if (!referenceIncident)
      return (
        <Button
          variant="danger"
          className="batch-action"
          disabled
          title="Cần một sự cố trên chain làm tham chiếu trước khi thu hồi."
        >
          <BanIcon />
          Chưa có sự cố tham chiếu
        </Button>
      )
    return (
      <Link
        className="button danger batch-action"
        to={`/admin/incidents/${referenceIncident.incidentId}?recall=${batch!.tokenId}`}
      >
        <BanIcon />
        Thu hồi lô này
      </Link>
    )
  }

  return (
    <div className="batches-page batch-detail-page">
      <PageHeader
        title={batch.batchCode}
        description={`tokenId #${batch.tokenId} · ${batch.farmId} / ${batch.harvestGroupId} · ${batch.quantityKg.toLocaleString('vi-VN')} kg · 1 NFT`}
        crumbs={[{ label: 'Lô hàng', to: '/admin/batches' }, { label: batch.batchCode }]}
        actions={
          <div className="batch-header-pills">
            <span className={`batch-status ${batch.lifecycle.toLowerCase()}`}>
              {LIFECYCLE_PILL[batch.lifecycle]}
            </span>
            {batch.expired && <span className="batch-status expired">Đã hết hạn</span>}
            {batch.recalled && (
              <span className="batch-status recalled">
                <AlertIcon size={13} />
                Đã thu hồi
              </span>
            )}
          </div>
        }
      />

      <section className="batch-stepper" aria-label="Trạng thái vòng đời lô">
        <ol>
          {STEPS.map((step, index) => {
            const done = index < currentIndex
            const current = index === currentIndex
            return (
              <li
                key={step}
                className={`batch-step ${done ? 'done' : current ? 'current' : 'pending'}${
                  index < STEPS.length - 1 ? ' has-line' : ''
                }${index < currentIndex ? ' line-done' : ''}`}
              >
                <span className="batch-step-dot">{done ? <CheckIcon /> : index + 1}</span>
                <span className="batch-step-label">{LIFECYCLE_LABELS[step]}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="batch-tabs-wrap">
        <div className="batch-tabs" ref={tabsRef} role="tablist" aria-label="Chi tiết lô">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`batch-tab ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="batch-tab-arrows">
          <button type="button" onClick={() => scrollTabs(-1)} aria-label="Cuộn tab sang trái">
            ▲
          </button>
          <button type="button" onClick={() => scrollTabs(1)} aria-label="Cuộn tab sang phải">
            ▼
          </button>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="batch-overview">
          <section className="batch-card batch-overview-main">
            <div className="batch-overview-grid">
              <Field label="tokenId">#{batch.tokenId}</Field>
              <Field label="batchCode">{batch.batchCode}</Field>
              <Field label="Khối lượng">{batch.quantityKg.toLocaleString('vi-VN')} kg</Field>

              <Field label="farmId">{batch.farmId}</Field>
              <Field label="farmLocation">{batch.farmLocation}</Field>
              <Field label="harvestGroupId">{batch.harvestGroupId}</Field>

              <Field label="harvestDate">{formatDate(batch.harvestDate)}</Field>
              <Field label="expiryDate">{formatTime(batch.expiryDate)}</Field>
              <Field label="Giống">{detail.variety ?? 'Không có trong metadata'}</Field>

              <Field label="Phân bón">{detail.fertilizer ?? 'Không có trong metadata'}</Field>
              <Field label="Nhiệt độ min/max">
                {tempMin}–{tempMax}°C
              </Field>
              <Field label="Chủ sở hữu NFT">
                <span className="batch-owner overview">
                  <span className="batch-owner-label">
                    <WalletIcon />
                    {partyText(batch.owner, detail.roleLabels)}
                  </span>
                  <span className="batch-owner-addr">
                    <span className="mono">{shortAddress(batch.owner)}</span>
                    <CopyButton text={batch.owner} message="Đã sao chép địa chỉ ví" />
                  </span>
                </span>
              </Field>

              <Field label="Vòng đời / Hết hạn / Thu hồi">
                <span className="batch-status-group">
                  <span className={`batch-status ${batch.lifecycle.toLowerCase()}`}>
                    {LIFECYCLE_PILL[batch.lifecycle]}
                  </span>
                  {batch.expired && <span className="batch-status expired">Đã hết hạn</span>}
                  {batch.recalled && <span className="batch-status recalled">Đã thu hồi</span>}
                </span>
              </Field>
              <Field label="metadata URI">
                <span className="batch-chip">
                  <span className="mono">tokenURI {detail.metadataCid || '—'}</span>
                  {detail.tokenUri && (
                    <CopyButton text={detail.tokenUri} message="Đã sao chép metadata URI" />
                  )}
                </span>
              </Field>
              <Field label="Giao dịch khởi tạo">
                {batch.createTx ? (
                  <span className="batch-tx">
                    <ExplorerLink kind="tx" value={batch.createTx}>
                      {shortHash(batch.createTx)}
                    </ExplorerLink>
                    <CopyButton text={batch.createTx} message="Đã sao chép mã giao dịch" />
                  </span>
                ) : (
                  'Không có event BatchCreated'
                )}
              </Field>
            </div>

            {batch.recall && (
              <div className="batch-warning recall">
                <span className="batch-warning-icon">
                  <AlertIcon />
                </span>
                <div>
                  <strong>Lô đã bị thu hồi</strong>
                  <p>
                    Thu hồi lúc {formatTime(batch.recall.at)} theo sự cố #{batch.recall.incidentId}.{' '}
                    {detail.recallReasonText
                      ? `Lý do: ${detail.recallReasonText}`
                      : 'Lý do lưu trong tệp trên IPFS, xem tab tài liệu công khai.'}
                  </p>
                </div>
              </div>
            )}

            {detail.sold && (
              <div className="batch-warning">
                <span className="batch-warning-icon">
                  <InfoIcon />
                </span>
                <div>
                  <strong>Đã bán cho Retailer</strong>
                  <p>
                    {partyText(detail.sold.retailer, detail.roleLabels)} ·{' '}
                    {formatTime(detail.sold.at)} ·{' '}
                    <ExplorerLink kind="tx" value={detail.sold.txHash}>
                      {shortHash(detail.sold.txHash)}
                    </ExplorerLink>
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className="batch-card batch-actions">
            <h2>Hành động</h2>
            <Link
              className="button secondary batch-action"
              to={`/trace/${config.chainId}/${config.contractAddress}/${batch.tokenId}`}
            >
              <ExternalIcon />
              Mở trang công khai
            </Link>
            {batchIncidents[0] && (
              <Link
                className="button secondary batch-action"
                to={`/admin/incidents/${batchIncidents[0].incidentId}`}
              >
                <FlagIcon />
                Xem sự cố #{batchIncidents[0].incidentId}
              </Link>
            )}
            {recallAction()}
            <p className="batch-actions-note">
              Thu hồi chỉ áp dụng cho đúng lô này và cần một sự cố tham chiếu tồn tại trên chain.
            </p>
          </aside>
        </div>
      )}

      {tab === 'public' && (
        <div className="batch-docs">
          {detail.documents.map((document) => (
            <article className="batch-doc-card" key={document.key}>
              <div className="batch-doc-head">
                <span className={`batch-doc-icon ${document.key}`}>
                  {document.key === 'metadata' && <span className="batch-braces">{'{}'}</span>}
                  {document.key === 'certificate' && <FileIcon />}
                  {document.key === 'image' && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="16"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <circle cx="9" cy="10" r="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="m4 18 5-4 4 3 3-2 4 3" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  )}
                </span>
                <div className="batch-doc-title">
                  <strong>{document.name}</strong>
                  <p>{document.label}</p>
                </div>
              </div>

              <div className="batch-doc-chip">
                <span>CID</span>
                <span className="mono">{document.cid || '—'}</span>
                {document.cid && <CopyButton text={document.cid} message="Đã sao chép CID" />}
              </div>
              <div className="batch-doc-chip">
                <span>ipfs://</span>
                <span className="mono">{document.cid ? `ipfs://${document.cid}` : '—'}</span>
              </div>
              <div className="batch-doc-chip">
                <span>SHA-256</span>
                <span className="mono break">{document.sha256 || '—'}</span>
                {document.sha256 && (
                  <CopyButton text={document.sha256} message="Đã sao chép SHA-256" />
                )}
              </div>

              <div className="batch-doc-actions">
                {document.fileUrl ? (
                  <a
                    className="button secondary"
                    href={document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalIcon />
                    Mở bản gốc
                  </a>
                ) : (
                  <span className="batch-doc-missing">Không có CID trong metadata</span>
                )}
              </div>

              <div className={`batch-doc-check ${document.verified}`}>
                <strong># Kiểm tra SHA-256</strong>
                <span>{verifyText(document.verified)}</span>
              </div>
            </article>
          ))}

          {batch.recall && detail.recallArtifact && (
            <article className="batch-doc-card">
              <div className="batch-doc-head">
                <span className="batch-doc-icon certificate">
                  <AlertIcon />
                </span>
                <div className="batch-doc-title">
                  <strong>
                    {detail.recallArtifact.kind === 'pdf'
                      ? 'ly-do-thu-hoi.pdf'
                      : 'recall-reason.json'}
                  </strong>
                  <p>Tệp lý do thu hồi ghi trong event BatchRecalled</p>
                </div>
              </div>
              <div className="batch-doc-chip">
                <span>CID</span>
                <span className="mono">{detail.recallArtifact.cid || '—'}</span>
              </div>
              <div className="batch-doc-chip">
                <span>SHA-256</span>
                <span className="mono break">{detail.recallArtifact.expectedSha256 || '—'}</span>
              </div>
              <div className="batch-doc-actions">
                {detail.recallArtifact.cid && (
                  <a
                    className="button secondary"
                    href={detail.recallArtifact.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalIcon />
                    Mở tệp lý do
                  </a>
                )}
              </div>
              <div className={`batch-doc-check ${detail.recallArtifact.verified}`}>
                <strong># Kiểm tra SHA-256</strong>
                <span>{verifyText(detail.recallArtifact.verified)}</span>
              </div>
            </article>
          )}
        </div>
      )}

      {tab === 'temperature' && (
        <div className="batch-temperature">
          {readings.length > 0 ? (
            <>
              <section className="batch-card batch-chart-card">
                <TemperatureChart readings={chartReadings} min={tempMin} max={tempMax} />
                <p className="batch-chart-note">
                  Dữ liệu đọc từ event TransitRecorded trên chain; số nguyên centi°C được chia 100.
                  Vùng xanh là ngưỡng trong metadata.
                </p>
              </section>

              <div className={`batch-warning ${overReadings.length > 0 ? '' : 'ok'}`}>
                <span className="batch-warning-icon">
                  {overReadings.length > 0 ? <AlertIcon /> : <CheckIcon />}
                </span>
                <div>
                  <strong>
                    {overReadings.length > 0
                      ? `Vượt ngưỡng nhiệt độ: ${overReadings.length} reading`
                      : 'Không có reading vượt ngưỡng'}
                  </strong>
                  <p>
                    {overReadings.length > 0
                      ? `Có ${overReadings.length}/${readings.length} reading ngoài khoảng ${tempMin}–${tempMax}°C${
                          maxTemp !== null ? `; cao nhất ${maxTemp.toFixed(2)}°C` : ''
                        }. Đây là dữ liệu đo, không phải kết luận nhiễm khuẩn.`
                      : 'Mọi reading trên chain nằm trong khoảng tham chiếu; vẫn cần đối chiếu hồ sơ và sự cố.'}
                  </p>
                </div>
              </div>

              <section className="batch-card batch-readings">
                <div className="batch-table-wrap">
                  <table className="batch-readings-table">
                    <thead>
                      <tr>
                        <th>READINGID</th>
                        <th>NHIỆT ĐỘ</th>
                        <th>OBSERVEDAT (THỜI ĐIỂM ĐỌC)</th>
                        <th>THỜI ĐIỂM BLOCK GHI</th>
                        <th>VỊ TRÍ</th>
                        <th>TXHASH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map((reading) => {
                        const over =
                          reading.temperatureC < tempMin || reading.temperatureC > tempMax
                        return (
                          <tr key={reading.readingId} className={over ? 'over' : ''}>
                            <td className="mono">#{reading.readingId}</td>
                            <td>
                              <strong className={over ? 'temp-over' : ''}>
                                {reading.temperatureC.toFixed(2)}°C
                              </strong>
                              <span>({Math.round(reading.temperatureC * 100)} centi°C)</span>
                              {over && <em>• vượt ngưỡng</em>}
                            </td>
                            <td>{formatTime(reading.observedAt)}</td>
                            <td>{formatTime(reading.at)}</td>
                            <td>{reading.location}</td>
                            <td>
                              <span className="batch-tx">
                                <ExplorerLink kind="tx" value={reading.txHash}>
                                  {shortHash(reading.txHash)}
                                </ExplorerLink>
                                <CopyButton
                                  text={reading.txHash}
                                  message="Đã sao chép mã giao dịch"
                                />
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="batch-card batch-empty-state">
              <h2>Chưa có bản ghi nhiệt độ</h2>
              <p>Lô này chưa có event TransitRecorded trên chain.</p>
            </section>
          )}
        </div>
      )}

      {tab === 'journey' && (
        <div className="batch-journey">
          <section className="batch-card batch-timeline">
            <h2>Dòng thời gian vận hành (provenance)</h2>
            {journey.length === 0 ? (
              <p className="batch-chart-note">Chưa có event hành trình trên chain.</p>
            ) : (
              <ol>
                {journey.map((event) => (
                  <li key={event.id} className={`journey-item ${event.kind}`}>
                    <span className="journey-icon">
                      {event.kind === 'mint' && <LeafIcon />}
                      {event.kind === 'transfer' && <TruckIcon />}
                      {event.kind === 'reading' && <ThermometerIcon />}
                      {event.kind === 'sold' && <StoreIcon />}
                      {event.kind === 'incident' && <FlagIcon />}
                      {event.kind === 'recall' && <AlertIcon size={17} />}
                    </span>
                    <div className="journey-body">
                      <strong>{event.title}</strong>
                      <p>{event.description}</p>
                      <span className="journey-meta">
                        {formatTime(event.time)} ·{' '}
                        <span className="batch-tx">
                          <ExplorerLink kind="tx" value={event.txHash}>
                            {shortHash(event.txHash)}
                          </ExplorerLink>
                          <CopyButton text={event.txHash} message="Đã sao chép mã giao dịch" />
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="batch-card batch-transfers">
            <h2>Lịch sử sở hữu ERC-721</h2>
            {detail.ownership.length === 0 ? (
              <p className="batch-chart-note">Chưa có event Transfer trên chain.</p>
            ) : (
              <div className="transfer-list">
                {detail.ownership.map((transfer, index) => (
                  <div className="transfer-item" key={transfer.txHash}>
                    <div className="transfer-head">
                      <strong>Transfer #{index + 1}</strong>
                      <span>
                        {partyText(transfer.from, detail.roleLabels)}{' '}
                        <span className="transfer-arrow">→</span>{' '}
                        {partyText(transfer.to, detail.roleLabels)}
                      </span>
                    </div>
                    <div className="transfer-meta">
                      <span>{formatTime(transfer.at)}</span>
                      <span className="batch-tx">
                        <ExplorerLink kind="tx" value={transfer.txHash}>
                          {shortHash(transfer.txHash)}
                        </ExplorerLink>
                        <CopyButton text={transfer.txHash} message="Đã sao chép mã giao dịch" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="batch-transfers-note">
              Lịch sử ERC-721 Transfer liệt kê mỗi lần đổi chủ đúng một lần (bao gồm mint từ địa chỉ
              0x0). Khác với dòng thời gian vận hành ở trên.
            </p>
          </section>
        </div>
      )}

      {tab === 'qr' && (
        <section className="batch-card batch-qr-card">
          <div className="batch-qr-box">
            <div className="batch-qr-canvas" ref={qrRef}>
              <QRCodeCanvas value={qrUrl} size={260} level="M" marginSize={2} />
            </div>
            <strong>{batch.batchCode}</strong>
          </div>

          <div className="batch-qr-main">
            <h2>Mã QR truy xuất</h2>
            <p className="batch-qr-url">
              <span className="mono break">{qrUrl}</span>
            </p>
            <div className="batch-qr-actions">
              <Button variant="secondary" onClick={() => copyText(qrUrl, 'Đã sao chép liên kết')}>
                <CopyIcon />
                Sao chép liên kết
              </Button>
              <Link
                className="button secondary"
                to={`/trace/${config.chainId}/${config.contractAddress}/${batch.tokenId}`}
              >
                <ExternalIcon />
                Mở trang truy xuất
              </Link>
              <Button variant="secondary" onClick={downloadQr}>
                <DownloadIcon />
                Tải mã QR
              </Button>
            </div>

            <div className="batch-tech">
              <div className="batch-tech-body">
                <p>Mạng</p>
                <code>
                  {networkName} · chainId {config.chainId}
                </code>
                <p>Hợp đồng</p>
                <code className="mono break">{config.contractAddress}</code>
                <p>tokenURI</p>
                <code className="mono break">{detail.tokenUri}</code>
                <p className="batch-tech-note">
                  QR trỏ thẳng tới trang tra cứu công khai theo chainId, địa chỉ hợp đồng và
                  tokenId. Không dùng dữ liệu mẫu.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
