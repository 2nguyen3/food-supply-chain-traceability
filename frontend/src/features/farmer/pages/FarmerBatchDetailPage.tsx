import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, EmptyState, ErrorState, LoadingState } from '../../../components/ui'
import { config } from '../../../config/env'
import type { Lifecycle } from '../../../domain/types'
import { TraceJourneyPanel, TraceNFTPanel, TraceTemperaturePanel } from '../../public/components/TracePanels'
import { TraceQRCode } from '../../public/components/TraceQRCode'
import { TraceIcon } from '../../public/components/TraceIcon'
import type { DemoBatch } from '../../public/mocks/traceDetailFixtures'
import {
  inspectPublicChain,
  parseProductionTraceParams,
  type PublicReadStatus,
} from '../../public/services/publicChainReader'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import { PrivateDocumentsPanel } from '../components/PrivateDocumentsPanel'
import { useFarmerSnapshot } from '../hooks/useFarmerSnapshot'
import type { FarmerBatch } from '../types'
import '../../public/styles/trace-detail.css'
import '../styles/farmer-batch-detail.css'

type TabId = 'overview' | 'public' | 'private' | 'temperature' | 'journey' | 'qr'
type IconName = 'box' | 'file' | 'lock' | 'thermo' | 'route' | 'qr'

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Tổng quan', icon: 'box' },
  { id: 'public', label: 'Tài liệu công khai', icon: 'file' },
  { id: 'private', label: 'Tài liệu riêng', icon: 'lock' },
  { id: 'temperature', label: 'Nhiệt độ', icon: 'thermo' },
  { id: 'journey', label: 'Hành trình & NFT', icon: 'route' },
  { id: 'qr', label: 'QR', icon: 'qr' },
]

const STEPS: { key: Lifecycle; label: string }[] = [
  { key: 'Created', label: 'Đã tạo' },
  { key: 'InTransit', label: 'Vận chuyển' },
  { key: 'Delivered', label: 'Đã giao' },
  { key: 'Sold', label: 'Đã bán' },
]

const STATUS_LABELS: Record<Lifecycle, string> = {
  Created: 'Đã tạo',
  InTransit: 'Đang vận chuyển',
  Delivered: 'Đã giao',
  Sold: 'Đã bán',
}

const ICON_PATHS: Record<IconName, string> = {
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 118 0v4',
  thermo: 'M10 14V5a2 2 0 114 0v9a4 4 0 11-4 0z',
  route: 'M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h7a3 3 0 000-6H9a3 3 0 010-6h7',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z',
}

function DetailIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

function LifecycleStepper({ lifecycle }: { lifecycle: Lifecycle }) {
  const current = STEPS.findIndex((step) => step.key === lifecycle)
  return (
    <Card className="farmer-detail-stepper-card">
      <ol className="farmer-detail-stepper" data-progress={lifecycle} aria-label="Vòng đời lô">
        {STEPS.map((step, index) => (
          <li key={step.key} className={index <= current ? 'complete' : ''} aria-current={index === current ? 'step' : undefined}>
            <span className="farmer-detail-stepper-mark">
              {index <= current ? <FarmerOverviewIcon name="check" /> : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function DetailField({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value || 'Chưa có dữ liệu'}</dd>
    </div>
  )
}

function transferBlockReason(batch: FarmerBatch): string {
  if (!batch.ownedByMe) return 'Bạn không phải chủ sở hữu NFT hiện tại.'
  if (batch.recalled) return 'Lô đã bị thu hồi.'
  if (batch.expired) return 'Lô đã hết hạn.'
  if (batch.pending) return 'Lô đang có yêu cầu bàn giao chờ xử lý.'
  if (batch.lifecycle !== 'Created') return 'Chỉ lô ở trạng thái Created mới chuyển được.'
  return ''
}

const formatMoment = (value?: string, withTime = false) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

const tracePath = (tokenId: string) => `/trace/${config.chainId}/${config.contractAddress}/${tokenId}`

function OverviewPanel({ batch, farmerBatch }: { batch: DemoBatch; farmerBatch: FarmerBatch }) {
  const reason = transferBlockReason(farmerBatch)
  const threshold =
    batch.minTemperatureC !== undefined && batch.maxTemperatureC !== undefined
      ? `${batch.minTemperatureC}–${batch.maxTemperatureC}°C`
      : undefined
  return (
    <div className="farmer-detail-overview">
      <Card className="farmer-detail-info-card">
        <dl className="farmer-detail-fields">
          <DetailField label="tokenId" value={`#${farmerBatch.tokenId}`} mono />
          <DetailField label="batchCode" value={farmerBatch.code} mono />
          <DetailField label="Khối lượng (cố định)" value="1.000 kg" />
          <DetailField label="farmId" value={farmerBatch.farmId} mono />
          <DetailField label="farmLocation" value={batch.farmLocation} />
          <DetailField label="harvestGroupId" value={farmerBatch.harvestGroupId} mono />
          <DetailField label="harvestDate" value={formatMoment(batch.harvestDate)} />
          <DetailField label="expiryDate" value={formatMoment(batch.expiryDate, true)} />
          <DetailField label="Giống" value={batch.variety} />
          <DetailField label="Phân bón" value={batch.fertilizer} />
          <DetailField label="Nhiệt độ min/max" value={threshold} />
          <DetailField label="Chủ sở hữu NFT" value={farmerBatch.ownedByMe ? `Bạn · ${farmerBatch.owner}` : `${farmerBatch.ownerLabel} · ${farmerBatch.owner}`} mono />
          <div>
            <dt>Vòng đời / Hết hạn / Thu hồi</dt>
            <dd className="farmer-detail-badges">
              <span className={`farmer-detail-status farmer-detail-status-${farmerBatch.lifecycle.toLowerCase()}`}>
                {farmerBatch.lifecycle} · {STATUS_LABELS[farmerBatch.lifecycle]}
              </span>
              {farmerBatch.expired && <span className="farmer-detail-status farmer-detail-status-expired">Hết hạn</span>}
              {farmerBatch.recalled && <span className="farmer-detail-status farmer-detail-status-recalled">Đã thu hồi</span>}
            </dd>
          </div>
          <DetailField label="metadata URI" value={batch.tokenUri} mono />
        </dl>
      </Card>
      <Card className="farmer-detail-actions">
        <h2>Hành động</h2>
        {!reason ? (
          <Link className="button farmer-detail-transfer" to="/farmer/transfers">
            Yêu cầu chuyển cho Logistics
          </Link>
        ) : (
          <>
            <button className="button farmer-detail-transfer" type="button" disabled>
              Yêu cầu chuyển cho Logistics
            </button>
            <p className="farmer-detail-reason">{reason}</p>
          </>
        )}
        <Link className="button secondary farmer-detail-public-link" to={tracePath(farmerBatch.tokenId)}>
          <TraceIcon name="external" /> Mở trang công khai
        </Link>
      </Card>
    </div>
  )
}

const VERIFY_TEXT = {
  match: 'SHA-256 của tệp tải về KHỚP hash trên blockchain.',
  mismatch: 'SHA-256 KHÔNG khớp hash trên blockchain: không coi là đã xác minh.',
  unavailable: 'Không tải được tệp để đối chiếu SHA-256.',
} as const

function PublicDocumentsPanel({ batch }: { batch: DemoBatch }) {
  const names = ['metadata.json', 'certificate.pdf', 'batch.jpg'] as const
  const icons = { 'metadata.json': 'json', 'certificate.pdf': 'file', 'batch.jpg': 'image' } as const
  return (
    <div className="farmer-detail-documents">
      {names.map((name) => {
        const document = batch.documents.find((item) => item.name === name)
        return (
          <Card className="farmer-detail-document" key={name}>
            <div className="farmer-detail-document-head">
              <span className="farmer-detail-document-icon"><TraceIcon name={icons[name]} /></span>
              <div><h2>{name}</h2><p>{document?.label ?? 'Hồ sơ công khai'}</p></div>
            </div>
            <div className="farmer-detail-file-facts">
              <p><span>CID</span> <code>{document?.cid ?? 'Chưa có dữ liệu'}</code></p>
              {document?.cid && <p><span>ipfs://</span> <code>ipfs://{document.cid}</code></p>}
              <p><span>SHA-256</span> <code>{document?.sha256 ?? 'Chưa có dữ liệu'}</code></p>
            </div>
            <div className="farmer-detail-file-actions">
              {document?.fileUrl ? (
                <>
                  <a className="button secondary" href={document.fileUrl} target="_blank" rel="noreferrer"><TraceIcon name="external" /> Xem bản gốc</a>
                  <a className="button secondary" href={document.fileUrl} download={name}><TraceIcon name="download" /> Tải tệp</a>
                </>
              ) : (
                <>
                  <button className="button secondary" disabled type="button" title="Chưa có tệp gốc"><TraceIcon name="external" /> Xem bản gốc</button>
                  <button className="button secondary" disabled type="button" title="Chưa có tệp gốc"><TraceIcon name="download" /> Tải tệp</button>
                </>
              )}
            </div>
            <div className="farmer-detail-hash">
              <strong><TraceIcon name="hash" /> Kiểm tra SHA-256</strong>
              <p><TraceIcon name="info" /> {document?.verified ? VERIFY_TEXT[document.verified] : 'Chưa đối chiếu SHA-256.'}</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function JourneyPanel({ batch }: { batch: DemoBatch }) {
  return (
    <div className="farmer-detail-journey">
      <Card>
        <h2>Dòng thời gian vận hành (provenance)</h2>
        <TraceJourneyPanel events={batch.events} live />
      </Card>
      <Card>
        <h2>Lịch sử sở hữu ERC-721</h2>
        <TraceNFTPanel ownership={batch.ownership} wallets={batch.wallets} />
      </Card>
    </div>
  )
}

type ChainState = { key: string; status: PublicReadStatus }

export function FarmerBatchDetailPage() {
  const { code: routeCode = '' } = useParams()
  const code = routeCode.trim().toUpperCase()
  const { result, loading, reload } = useFarmerSnapshot()
  const [tab, setTab] = useState<TabId>('overview')
  const [mobileOpen, setMobileOpen] = useState<TabId | null>('overview')
  const [chain, setChain] = useState<ChainState | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const snapshot = result?.kind === 'ready' ? result.snapshot : null
  const farmerBatch = snapshot?.batches.find((item) => item.code === code)
  const chainKey = farmerBatch ? `${farmerBatch.tokenId}:${farmerBatch.lifecycle}:${farmerBatch.owner}` : ''

  // Hồ sơ, sự kiện, nhiệt độ của lô: dùng bộ đọc chain công khai (đối chiếu SHA-256 với hash trên chain)
  useEffect(() => {
    if (!farmerBatch || !config.contractAddress) return
    const parsed = parseProductionTraceParams(String(config.chainId), config.contractAddress, farmerBatch.tokenId)
    if (!parsed.identity) return
    const controller = new AbortController()
    inspectPublicChain(parsed.identity, controller.signal).then(
      (status) => {
        if (!controller.signal.aborted) setChain({ key: chainKey, status })
      },
      () => {
        if (!controller.signal.aborted) setChain({ key: chainKey, status: { kind: 'rpcUnavailable' } })
      },
    )
    return () => controller.abort()
  }, [farmerBatch, chainKey])

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    else return
    event.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  const chainResult = chain?.key === chainKey ? chain.status : null
  const demoBatch = chainResult?.kind === 'ok' ? chainResult.batch : null
  const chainLoading = !!farmerBatch && !chainResult
  const renderPanel = (panel: TabId, batch: DemoBatch, record: FarmerBatch) => {
    switch (panel) {
      case 'overview': return <OverviewPanel batch={batch} farmerBatch={record} />
      case 'public': return <PublicDocumentsPanel batch={batch} />
      case 'private': return <PrivateDocumentsPanel tokenId={record.tokenId} />
      case 'temperature': return <Card className="farmer-detail-section"><TraceTemperaturePanel batch={batch} /></Card>
      case 'journey': return <JourneyPanel batch={batch} />
      case 'qr': return <TraceQRCode code={batch.code} path={tracePath(record.tokenId)} />
    }
  }

  return (
    <div className="farmer-detail-page">
      <nav className="farmer-detail-breadcrumb" aria-label="Đường dẫn">
        <Link to="/farmer/batches">Lô hàng</Link><span aria-hidden="true">›</span><span>{code || 'Chi tiết lô'}</span>
      </nav>

      {loading || chainLoading ? (
        <Card className="farmer-detail-feedback"><LoadingState label="Đang tải thông tin lô…" /></Card>
      ) : result?.kind === 'error' ? (
        <ErrorState title="Không thể đọc dữ liệu lô" description={result.message} action={<button className="button" type="button" onClick={reload}>Thử lại</button>} />
      ) : result?.kind === 'unassigned' ? (
        <EmptyState title="Chưa có liên kết farmId" description="Admin cần gán farmId cho ví của bạn trên hợp đồng." />
      ) : result?.kind === 'noWallet' ? (
        <EmptyState title="Cần đăng nhập bằng ví thật" description="Phiên xem giao diện không có dữ liệu trên blockchain. Hãy đăng xuất rồi kết nối MetaMask." />
      ) : snapshot && !farmerBatch ? (
        <ErrorState title="Không tìm thấy lô" description={`Bạn chưa tạo lô nào mang mã ${code || 'được yêu cầu'}. Chỉ hiển thị các lô do ví này tạo.`} action={<Link className="button" to="/farmer/batches">Về Lô của tôi</Link>} />
      ) : farmerBatch && chainResult && chainResult.kind !== 'ok' ? (
        <ErrorState title="Không đọc được chi tiết lô" description="Không đọc được hồ sơ hoặc sự kiện của lô từ blockchain hay IPFS. Hãy thử lại." action={<button className="button" type="button" onClick={reload}>Thử lại</button>} />
      ) : demoBatch && farmerBatch ? (
        <>
          <header className="farmer-detail-header">
            <div>
              <h1>{farmerBatch.code}</h1>
              <p>tokenId #{farmerBatch.tokenId} · {farmerBatch.farmId} / {farmerBatch.harvestGroupId} · 1.000 kg · 1 NFT</p>
            </div>
            <div className="farmer-detail-header-badges">
              <span className={`farmer-detail-status farmer-detail-status-${farmerBatch.lifecycle.toLowerCase()}`}>
                {farmerBatch.lifecycle} · {STATUS_LABELS[farmerBatch.lifecycle]}
              </span>
              {farmerBatch.expired && <span className="farmer-detail-status farmer-detail-status-expired">Hết hạn</span>}
              {farmerBatch.recalled && <span className="farmer-detail-status farmer-detail-status-recalled">Đã thu hồi</span>}
            </div>
          </header>

          <LifecycleStepper lifecycle={farmerBatch.lifecycle} />

          <div className="farmer-detail-tabs" role="tablist" aria-label="Chi tiết lô">
            {TABS.map((item, index) => (
              <button
                key={item.id}
                ref={(element) => { tabRefs.current[index] = element }}
                id={`farmer-detail-tab-${item.id}`}
                role="tab"
                type="button"
                aria-selected={tab === item.id}
                aria-controls="farmer-detail-panel"
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                <DetailIcon name={item.icon} /><span>{item.label}</span>
              </button>
            ))}
          </div>
          <div id="farmer-detail-panel" className="farmer-detail-desktop-panel" role="tabpanel" aria-labelledby={`farmer-detail-tab-${tab}`} tabIndex={0}>
            {renderPanel(tab, demoBatch, farmerBatch)}
          </div>
          <div className="farmer-detail-mobile-sections">
            {TABS.map((item) => (
              <section className="farmer-detail-accordion" key={item.id}>
                <h2><button type="button" aria-expanded={mobileOpen === item.id} aria-controls={`farmer-detail-mobile-${item.id}`} onClick={() => setMobileOpen((current) => current === item.id ? null : item.id)}><DetailIcon name={item.icon} />{item.label}<TraceIcon name="down" /></button></h2>
                {mobileOpen === item.id && <div id={`farmer-detail-mobile-${item.id}`} className="farmer-detail-accordion-content">{renderPanel(item.id, demoBatch, farmerBatch)}</div>}
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
