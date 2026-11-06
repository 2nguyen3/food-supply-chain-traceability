import { useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { Button, Modal, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import type { Lifecycle } from '../../domain/types'
import {
  getBatchDetail,
  JOURNEY_EVENTS,
  LIFECYCLE_LABELS,
  LIFECYCLE_PILL,
  METADATA_JSON,
  NFT_TRANSFERS,
  PUBLIC_DOCUMENTS,
  QR_DEMO_PATH,
  QR_TECHNICAL,
  READINGS,
  type BatchDetail,
  type PublicDocument,
} from './batchFixtures'
import { useRecalls } from './incidentStore'
import { INCIDENTS } from './incidentFixtures'
import { TemperatureChart } from './TemperatureChart'
import './styles/batches.css'

type TabId = 'overview' | 'public' | 'private' | 'temperature' | 'journey' | 'qr'

const STEPS: Lifecycle[] = ['Created', 'InTransit', 'Delivered', 'Sold']

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
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

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
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

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4.5"
        y="10"
        width="15"
        height="10.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={open ? 'open' : ''}
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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

function CertificatePreview({ detail }: { detail: BatchDetail }) {
  return (
    <div className="cert-preview">
      <div className="cert-sheet">
        <img className="cert-logo" src="/brand/Primary.svg" width="76" height="76" alt="" />
        <p className="cert-brand">COCOMARK</p>
        <h3>Giấy chứng nhận lô dừa</h3>
        <p className="cert-sub">Số {detail.code} · Mẫu cho prototype</p>
        <dl className="cert-rows">
          <div>
            <dt>Trang trại</dt>
            <dd>
              {detail.farmId} · {detail.farmLocation}
            </dd>
          </div>
          <div>
            <dt>Nhóm thu hoạch</dt>
            <dd>{detail.groupId}</dd>
          </div>
          <div>
            <dt>Giống</dt>
            <dd>{detail.variety}</dd>
          </div>
          <div>
            <dt>Khối lượng</dt>
            <dd>{detail.weightKg.toLocaleString('vi-VN')} kg</dd>
          </div>
          <div>
            <dt>Thu hoạch</dt>
            <dd>{detail.harvestDate}</dd>
          </div>
        </dl>
        <p className="cert-note">
          Đây là bản xem trước trong ứng dụng. Tệp PDF mẫu: <strong>certificate.pdf</strong>{' '}
          (fixture). Không phải chứng chỉ thật.
        </p>
      </div>
    </div>
  )
}

function BatchImagePreview({ code }: { code: string }) {
  return (
    <figure className="batch-image-figure">
      <svg
        viewBox="0 0 1000 560"
        className="batch-image-preview"
        role="img"
        aria-label={`Ảnh gốc của lô ${code}`}
      >
        <defs>
          <linearGradient id="batch-photo-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dfeacb" />
            <stop offset="100%" stopColor="#b9d3a4" />
          </linearGradient>
          <radialGradient id="coconut-shade" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#9b6a3d" />
            <stop offset="100%" stopColor="#5d3a1d" />
          </radialGradient>
        </defs>
        <rect width="1000" height="560" fill="url(#batch-photo-bg)" />
        <path d="M0 430c160-50 320-70 500-40s340 10 500-30v200H0Z" fill="#8fb277" />
        <g opacity="0.75" fill="#2d6a4f">
          <path d="M120 300c90-120 240-150 330-90-110 10-220 50-330 90Z" />
          <path d="M880 290c-80-125-230-160-325-105 110 15 215 60 325 105Z" />
        </g>
        <g>
          <ellipse cx="360" cy="390" rx="96" ry="86" fill="url(#coconut-shade)" />
          <ellipse cx="520" cy="410" rx="104" ry="92" fill="url(#coconut-shade)" />
          <ellipse cx="680" cy="392" rx="94" ry="84" fill="url(#coconut-shade)" />
          <ellipse cx="440" cy="300" rx="86" ry="78" fill="url(#coconut-shade)" />
          <ellipse cx="600" cy="296" rx="88" ry="80" fill="url(#coconut-shade)" />
          <g fill="#3f2611">
            <circle cx="430" cy="292" r="8" />
            <circle cx="448" cy="286" r="7" />
            <circle cx="452" cy="304" r="7" />
            <circle cx="590" cy="288" r="8" />
            <circle cx="608" cy="282" r="7" />
            <circle cx="612" cy="300" r="7" />
          </g>
        </g>
        <rect x="300" y="470" width="400" height="34" rx="17" fill="#6f4a2a" opacity="0.75" />
        <text x="500" y="494" textAnchor="middle" fill="#fff3e5" fontSize="18" fontWeight="600">
          COCOMARK · {code} · FARM-A
        </text>
      </svg>
      <figcaption>Ảnh minh họa fixture cho lô {code}.</figcaption>
    </figure>
  )
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BatchDetailPage() {
  const { code = '' } = useParams()
  const detail = getBatchDetail(code)
  const { showToast } = useToast()
  const [tab, setTab] = useState<TabId>('overview')
  const [docModal, setDocModal] = useState<PublicDocument | null>(null)
  const [techOpen, setTechOpen] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const recalls = useRecalls()

  if (!detail) {
    return (
      <div className="batches-page">
        <PageHeader
          title="Không tìm thấy lô"
          description="Mã lô không tồn tại trong dữ liệu demo."
          crumbs={[{ label: 'Lô hàng', to: '/admin/batches' }]}
        />
        <Link className="button" to="/admin/batches">
          Quay lại danh sách lô
        </Link>
      </div>
    )
  }

  const currentIndex = STEPS.indexOf(detail.lifecycle)
  const readings = detail.code === 'COCONUT-001' ? READINGS : []
  const overReading = readings.find((reading) => reading.over)
  const qrUrl = `${window.location.origin}${QR_DEMO_PATH}`
  const recall = recalls[detail.code]

  const journey = JOURNEY_EVENTS.filter((event) => {
    if (event.id === 'mint') return true
    if (event.id === 'handoff-logistics') return currentIndex >= 1
    if (event.id.startsWith('reading-')) return detail.code === 'COCONUT-001' && currentIndex >= 1
    if (event.id === 'handoff-retailer') return currentIndex >= 2
    if (event.id === 'sold') return currentIndex >= 3
    return true
  })

  const incident = INCIDENTS.find((incident) => incident.batchCode === detail.code)
  if (incident) {
    journey.push({
      id: `incident-${incident.id}`,
      kind: 'incident',
      title: 'Báo cáo sự cố',
      description: `${incident.reporter} báo cáo sự cố ${incident.id}`,
      time: incident.time,
      txHash: incident.reportTx,
    })
  }
  if (recall) {
    journey.push({
      id: `recall-${recall.batchCode}`,
      kind: 'recall',
      title: 'Thu hồi lô',
      description: `Thu hồi lô do sự cố ${recall.incidentId}. Lý do: ${recall.reason}`,
      time: recall.time,
      txHash: recall.txHash,
    })
  }

  const transfers = NFT_TRANSFERS.filter((transfer) => {
    if (transfer.id === 1) return true
    if (transfer.id === 2) return currentIndex >= 1
    return currentIndex >= 2
  })

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'overview', label: 'Tổng quan', icon: <BoxIcon /> },
    { id: 'public', label: 'Tài liệu công khai', icon: <FileIcon /> },
    { id: 'private', label: 'Tài liệu riêng', icon: <LockIcon /> },
    { id: 'temperature', label: 'Nhiệt độ', icon: <ThermometerIcon /> },
    { id: 'journey', label: 'Hành trình & NFT', icon: <RouteIcon /> },
    { id: 'qr', label: 'QR', icon: <QrIcon /> },
  ]

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  function downloadQr() {
    if (!detail) return
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) {
      showToast('Không thể tạo ảnh QR', 'error')
      return
    }
    const fileName = `${detail.code}-qr.png`
    const save = (href: string) => {
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      showToast('Đã tải ảnh QR (URL demo)')
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        save(canvas.toDataURL('image/png'))
        return
      }
      const url = URL.createObjectURL(blob)
      save(url)
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  function downloadDocument(document: PublicDocument) {
    if (!detail) return
    if (document.id === 'metadata') {
      downloadFile(document.name, JSON.stringify(METADATA_JSON, null, 2), 'application/json')
      showToast('Đã tải tệp demo')
      return
    }
    if (document.id === 'certificate') {
      const text = `COCOMARK - GIẤY CHỨNG NHẬN NGUỒN GỐC\nLô hàng: ${detail.code}\nNông trại: ${detail.farmId} - ${detail.farmLocation}\nNgày thu hoạch: ${detail.harvestDate}\nKhối lượng: 1.000 kg\n\nTài liệu mô phỏng cho prototype COCOMARK.`
      downloadFile(document.name, text, 'application/pdf')
      showToast('Đã tải tệp demo')
      return
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#b9d3a4"/><circle cx="420" cy="470" r="130" fill="#5d3a1d"/><circle cx="640" cy="490" r="140" fill="#5d3a1d"/><circle cx="840" cy="470" r="125" fill="#5d3a1d"/><text x="600" y="720" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#fff3e5">COCOMARK - ${detail.code}</text></svg>`
    downloadFile(document.name, svg, 'image/svg+xml')
    showToast('Đã tải tệp demo')
  }

  function scrollTabs(direction: number) {
    tabsRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' })
  }

  return (
    <div className="batches-page batch-detail-page">
      <PageHeader
        title={detail.code}
        description={`tokenId #${detail.tokenId} · ${detail.farmId} / ${detail.groupId} · ${detail.weightKg.toLocaleString('vi-VN')} kg · 1 NFT`}
        crumbs={[{ label: 'Lô hàng', to: '/admin/batches' }, { label: detail.code }]}
        actions={
          <div className="batch-header-pills">
            <span className={`batch-status ${detail.lifecycle.toLowerCase()}`}>
              {LIFECYCLE_PILL[detail.lifecycle]}
            </span>
            {recall && <span className="batch-status recalled">Đã thu hồi</span>}
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
              <Field label="tokenId">#{detail.tokenId}</Field>
              <Field label="batchCode">{detail.code}</Field>
              <Field label="Khối lượng (cố định)">
                {detail.weightKg.toLocaleString('vi-VN')} kg
              </Field>

              <Field label="farmId">{detail.farmId}</Field>
              <Field label="farmLocation">{detail.farmLocation}</Field>
              <Field label="harvestGroupId">{detail.groupId}</Field>

              <Field label="harvestDate">{detail.harvestDate}</Field>
              <Field label="expiryDate">{detail.expiryDate}</Field>
              <Field label="Giống">{detail.variety}</Field>

              <Field label="Phân bón">{detail.fertilizer}</Field>
              <Field label="Nhiệt độ min/max">
                {detail.tempMin}–{detail.tempMax}°C
              </Field>
              <Field label="Chủ sở hữu NFT">
                <span className="batch-owner overview">
                  <span className="batch-owner-label">
                    <WalletIcon />
                    {detail.ownerLabel}
                  </span>
                  <span className="batch-owner-addr">
                    <span className="mono">{shortAddress(detail.ownerAddress)}</span>
                    <CopyButton text={detail.ownerAddress} message="Đã sao chép địa chỉ ví" />
                  </span>
                </span>
              </Field>

              <Field label="Vòng đời / Hết hạn / Thu hồi">
                <span className="batch-status-group">
                  <span className={`batch-status ${detail.lifecycle.toLowerCase()}`}>
                    {LIFECYCLE_PILL[detail.lifecycle]}
                  </span>
                  {recall && <span className="batch-status recalled">Đã thu hồi</span>}
                </span>
              </Field>
              <Field label="metadata URI">
                <span className="batch-chip">
                  <span className="mono">tokenURI {detail.metadataCid}</span>
                  <CopyButton text={detail.metadataUri} message="Đã sao chép metadata URI" />
                </span>
              </Field>
            </div>
          </section>

          <aside className="batch-card batch-actions">
            <h2>Hành động</h2>
            <Link className="button secondary batch-action" to="/admin/incidents">
              <FlagIcon />
              Xem sự cố
            </Link>
            <Link className="button secondary batch-action" to={QR_DEMO_PATH}>
              <ExternalIcon />
              Mở trang công khai
            </Link>
          </aside>
        </div>
      )}

      {tab === 'public' && (
        <div className="batch-docs">
          {PUBLIC_DOCUMENTS.map((document) => (
            <article className="batch-doc-card" key={document.id}>
              <div className="batch-doc-head">
                <span className={`batch-doc-icon ${document.id}`}>
                  {document.id === 'metadata' && <span className="batch-braces">{'{}'}</span>}
                  {document.id === 'certificate' && <FileIcon />}
                  {document.id === 'image' && (
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
                  <span className="batch-fixture">FIXTURE</span>
                  <p>
                    {document.description} · {document.size}
                  </p>
                </div>
              </div>

              <div className="batch-doc-chip">
                <span>CID</span>
                <span className="mono">{document.shortCid}</span>
                <CopyButton text={document.cid} message="Đã sao chép CID" />
              </div>
              <div className="batch-doc-chip">
                <span>SHA-256</span>
                <span className="mono">{document.shortSha}</span>
                <CopyButton text={document.sha256} message="Đã sao chép SHA-256" />
              </div>

              <div className="batch-doc-actions">
                <Button variant="secondary" onClick={() => setDocModal(document)}>
                  <EyeIcon />
                  Xem bản gốc
                </Button>
                <Button variant="secondary" onClick={() => downloadDocument(document)}>
                  <DownloadIcon />
                  Mở/tải tệp
                </Button>
              </div>

              <div className="batch-doc-check">
                <strong># Kiểm tra SHA-256</strong>
                <span>Chưa đối chiếu SHA-256.</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'private' &&
        (detail.code === 'COCONUT-001' ? (
          <div className="batch-private">
            <div className="batch-warning">
              <span className="batch-warning-icon">
                <AlertIcon />
              </span>
              <div>
                <strong>Hóa đơn bán buôn riêng (ACL ngoài chuỗi)</strong>
                <p>
                  Hóa đơn không công khai. Chỉ ví tải lên và ví được cấp quyền mới đọc được, sau khi
                  ký phiên truy cập.
                </p>
              </div>
            </div>

            <section className="batch-card batch-private-card">
              <div className="batch-private-head">
                <span className="batch-doc-icon private">
                  <LockIcon />
                </span>
                <div>
                  <strong>hoa-don-si-{detail.code}.pdf</strong>
                  <span>DOC-001 · 96 KB · gắn token #{detail.tokenId} · mã hóa riêng</span>
                </div>
              </div>

              <div className="batch-403">
                <span className="batch-403-icon">
                  <AlertIcon />
                </span>
                <h3>403 - Không có quyền đọc tài liệu</h3>
                <p>
                  Admin không có quyền mặc định với hóa đơn riêng; chưa được uploader cấp quyền
                  (403).
                </p>
              </div>

              <p className="batch-private-foot">
                Bạn đang xem với ví Admin. Chỉ uploader mới thấy phần quản lý quyền.
              </p>
            </section>
          </div>
        ) : (
          <div className="batch-private-empty">
            <span className="batch-private-empty-icon">
              <InfoIcon />
            </span>
            <p>
              Lô này chưa có hóa đơn bán buôn riêng. Farmer có thể tải lên ở bước 3 của trình tạo
              lô.
            </p>
          </div>
        ))}

      {tab === 'temperature' && (
        <div className="batch-temperature">
          {readings.length > 0 ? (
            <>
              <section className="batch-card batch-chart-card">
                <TemperatureChart readings={readings} min={detail.tempMin} max={detail.tempMax} />
                <p className="batch-chart-note">
                  Giá trị đọc từ CSV bởi script Python/Web3.py (không phải cảm biến vật lý). Vùng
                  xanh là ngưỡng minh họa trong metadata.
                </p>
              </section>

              {overReading && (
                <div className="batch-warning">
                  <span className="batch-warning-icon">
                    <AlertIcon />
                  </span>
                  <div>
                    <strong>Vượt ngưỡng nhiệt độ: {overReading.temperatureC}°C</strong>
                    <p>
                      Đây là một lần vượt ngưỡng nhiệt độ ghi nhận trong dữ liệu vận chuyển, không
                      tự động là bằng chứng nhiễm khuẩn hay mất an toàn thực phẩm.
                    </p>
                  </div>
                </div>
              )}

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
                      {readings.map((reading) => (
                        <tr key={reading.id} className={reading.over ? 'over' : ''}>
                          <td className="mono">#{reading.id}</td>
                          <td>
                            <strong className={reading.over ? 'temp-over' : ''}>
                              {reading.temperatureC.toFixed(1)}°C
                            </strong>
                            <span>({reading.centiC} centi°C)</span>
                            {reading.over && <em>• vượt ngưỡng</em>}
                          </td>
                          <td>{reading.observedAt}</td>
                          <td>{reading.blockAt}</td>
                          <td>{reading.location}</td>
                          <td>
                            <span className="batch-tx">
                              <span className="mono">{shortHash(reading.txHash)}</span>
                              <CopyButton
                                text={reading.txHash}
                                message="Đã sao chép mã giao dịch"
                              />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <section className="batch-card batch-empty-state">
              <h2>Chưa có bản ghi nhiệt độ</h2>
              <p>Lô này chưa có dữ liệu vận chuyển trong phiên demo.</p>
            </section>
          )}
        </div>
      )}

      {tab === 'journey' && (
        <div className="batch-journey">
          <section className="batch-card batch-timeline">
            <h2>Dòng thời gian vận hành (provenance)</h2>
            <ol>
              {journey.map((event) => (
                <li key={event.id} className={`journey-item ${event.kind}`}>
                  <span className="journey-icon">
                    {event.kind === 'mint' && <LeafIcon />}
                    {event.kind === 'handoff' && <TruckIcon />}
                    {event.kind === 'reading' && <ThermometerIcon />}
                    {event.kind === 'sold' && <StoreIcon />}
                    {event.kind === 'incident' && <FlagIcon />}
                    {event.kind === 'recall' && <AlertIcon />}
                  </span>
                  <div className="journey-body">
                    <strong>{event.title}</strong>
                    <p>{event.description.replaceAll('COCONUT-001', detail.code)}</p>
                    <span className="journey-meta">
                      {event.time} ·{' '}
                      <span className="batch-tx">
                        <span className="mono">{shortHash(event.txHash)}</span>
                        <CopyButton text={event.txHash} message="Đã sao chép mã giao dịch" />
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="batch-card batch-transfers">
            <h2>Lịch sử sở hữu ERC-721</h2>
            <div className="transfer-list">
              {transfers.map((transfer) => (
                <div className="transfer-item" key={transfer.id}>
                  <div className="transfer-head">
                    <strong>Transfer #{transfer.id}</strong>
                    <span>
                      {transfer.from} <span className="transfer-arrow">→</span> {transfer.to}
                    </span>
                  </div>
                  <div className="transfer-meta">
                    <span>{transfer.time}</span>
                    <span className="batch-tx">
                      <span className="mono">{shortHash(transfer.txHash)}</span>
                      <CopyButton text={transfer.txHash} message="Đã sao chép mã giao dịch" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="batch-transfers-note">
              Lịch sử ERC-721 Transfer liệt kê mỗi lần đổi chủ đúng một lần (bao gồm mint từ địa chỉ
              0x0). Khác với dòng thời gian vận hành ở tab Hành trình.
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
            <strong>{detail.code}</strong>
          </div>

          <div className="batch-qr-main">
            <h2>Mã QR truy xuất</h2>
            <div className="batch-qr-actions">
              <Button variant="secondary" onClick={() => copyText(qrUrl, 'Đã sao chép liên kết')}>
                <CopyIcon />
                Sao chép liên kết
              </Button>
              <Link className="button secondary" to={QR_DEMO_PATH}>
                <ExternalIcon />
                Mở trang truy xuất
              </Link>
              <Button variant="secondary" onClick={downloadQr}>
                <DownloadIcon />
                Tải mã QR
              </Button>
            </div>

            <div className="batch-tech">
              <button
                type="button"
                className="batch-tech-toggle"
                aria-expanded={techOpen}
                onClick={() => setTechOpen((current) => !current)}
              >
                Thông tin kỹ thuật
                <ChevronIcon open={techOpen} />
              </button>
              {techOpen && (
                <div className="batch-tech-body">
                  <p>URL được mã hóa trong QR (bản demo)</p>
                  <code>{qrUrl}</code>
                  <p>URL chuẩn khi triển khai chính thức</p>
                  <code>{QR_TECHNICAL.canonical}</code>
                  <p className="batch-tech-note">{QR_TECHNICAL.note}</p>
                  <div className="batch-tech-chips">
                    <span className="batch-chip">
                      <span className="mono">tokenURI {QR_TECHNICAL.tokenUri}</span>
                      <CopyButton text={QR_TECHNICAL.ipfs} message="Đã sao chép tokenURI" />
                    </span>
                    <span className="batch-chip">
                      <span className="mono">{QR_TECHNICAL.ipfs}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <Modal
        open={!!docModal}
        onClose={() => setDocModal(null)}
        title={docModal ? `${docModal.name} - bản gốc (fixture)` : 'Bản gốc tài liệu'}
        wide
        className="batch-doc-modal"
      >
        {docModal?.id === 'metadata' && (
          <pre className="doc-json">{JSON.stringify(METADATA_JSON, null, 2)}</pre>
        )}
        {docModal?.id === 'certificate' && <CertificatePreview detail={detail} />}
        {docModal?.id === 'image' && <BatchImagePreview code={detail.code} />}
      </Modal>
    </div>
  )
}
