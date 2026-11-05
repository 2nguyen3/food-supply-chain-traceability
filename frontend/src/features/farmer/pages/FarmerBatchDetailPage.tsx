import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { Card, EmptyState, ErrorState, LoadingState } from '../../../components/ui'
import type { Lifecycle } from '../../../domain/types'
import { TraceJourneyPanel, TraceNFTPanel, TraceTemperaturePanel } from '../../public/components/TracePanels'
import { TraceQRCode } from '../../public/components/TraceQRCode'
import { TraceIcon } from '../../public/components/TraceIcon'
import { getDemoBatch, type DemoBatch } from '../../public/mocks/traceDetailFixtures'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import { downloadPreviewInvoice, FARMER_PRIVATE_INVOICE, farmerPreviewEvents } from '../mocks/farmerBatchDetailPreview'
import type { FarmerOverviewBatch, PreviewFarmId } from '../mocks/farmerOverviewFixtures'
import { farmerOverviewReader, type FarmerOverviewResult } from '../services/farmerOverviewService'
import '../../public/styles/trace-detail.css'
import '../styles/farmer-batch-detail.css'

type ReadState = { key: string; result: FarmerOverviewResult }
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

function OverviewPanel({ batch, farmerBatch, previewFarmId }: { batch: DemoBatch; farmerBatch: FarmerOverviewBatch; previewFarmId: PreviewFarmId | null }) {
  const isOwner = farmerBatch.ownerFarmId === previewFarmId
  const expired = batch.expiryDate ? Date.now() >= Date.parse(batch.expiryDate) : false
  const threshold = batch.minTemperatureC !== undefined && batch.maxTemperatureC !== undefined
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
          <DetailField label="harvestDate" value={batch.harvestDate} />
          <DetailField label="expiryDate" value={batch.expiryDate} />
          <DetailField label="Giống" value={batch.variety} />
          <DetailField label="Phân bón" value={batch.fertilizer} />
          <DetailField label="Nhiệt độ min/max" value={threshold} />
          <DetailField label="Chủ sở hữu NFT" value={`${farmerBatch.ownerLabel} · chưa có địa chỉ ví`} />
          <div>
            <dt>Vòng đời / Hết hạn / Thu hồi</dt>
            <dd className="farmer-detail-badges">
              <span className={`farmer-detail-status farmer-detail-status-${farmerBatch.lifecycle.toLowerCase()}`}>
                {farmerBatch.lifecycle} · {STATUS_LABELS[farmerBatch.lifecycle]}
              </span>
              {expired && <span className="farmer-detail-status farmer-detail-status-expired">Hết hạn</span>}
              {batch.recalled && <span className="farmer-detail-status farmer-detail-status-recalled">Đã thu hồi</span>}
            </dd>
          </div>
          <DetailField label="metadata URI" value={batch.tokenUri} mono />
        </dl>
      </Card>
      <Card className="farmer-detail-actions">
        <h2>Hành động</h2>
        {isOwner ? (
          <Link className="button farmer-detail-transfer" to="/farmer/transfers">
            Yêu cầu chuyển cho Logistics
          </Link>
        ) : (
          <>
            <button className="button farmer-detail-transfer" type="button" disabled>
              Yêu cầu chuyển cho Logistics
            </button>
            <p className="farmer-detail-reason">Bạn không phải chủ sở hữu NFT hiện tại.</p>
          </>
        )}
        <Link className="button secondary farmer-detail-public-link" to={`/trace/demo/${batch.code}`}>
          <TraceIcon name="external" /> Mở trang công khai
        </Link>
        {!isOwner && <p>Bạn đang xem lô đã chuyển quyền sở hữu ở chế độ chỉ đọc.</p>}
      </Card>
    </div>
  )
}

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
              <div><h2>{name} <span className="farmer-detail-fixture">FIXTURE</span></h2><p>{document?.label ?? 'Hồ sơ công khai'}</p></div>
            </div>
            <div className="farmer-detail-file-facts">
              <p><span>CID</span> <code>{document?.cid ?? 'Chưa có dữ liệu'}</code></p>
              <p><span>SHA-256</span> <code>{document?.sha256 ?? 'Chưa có dữ liệu'}</code></p>
            </div>
            <div className="farmer-detail-file-actions">
              {document?.fileUrl ? (
                <><a className="button secondary" href={document.fileUrl} target="_blank" rel="noreferrer"><TraceIcon name="external" /> Xem bản gốc</a><a className="button secondary" href={document.fileUrl} download={name}><TraceIcon name="download" /> Mở/tải tệp</a></>
              ) : (
                <><button className="button secondary" disabled type="button" title="Chưa có tệp gốc"><TraceIcon name="external" /> Xem bản gốc</button><button className="button secondary" disabled type="button" title="Chưa có tệp gốc"><TraceIcon name="download" /> Mở/tải tệp</button></>
              )}
            </div>
            <div className="farmer-detail-hash"><strong><TraceIcon name="hash" /> Kiểm tra SHA-256</strong><p><TraceIcon name="info" /> Chưa đối chiếu SHA-256.</p></div>
          </Card>
        )
      })}
    </div>
  )
}

function PrivateDocumentsPanel({ batch, preview }: { batch: DemoBatch; preview: boolean }) {
  const [grants, setGrants] = useState<Record<'Logistics' | 'Retailer', boolean>>({ Logistics: false, Retailer: false })
  const invoice = preview && batch.code === FARMER_PRIVATE_INVOICE.batchCode ? FARMER_PRIVATE_INVOICE : null
  return (
    <div className="farmer-detail-private">
      <div className="farmer-detail-private-notice"><TraceIcon name="warn" /><div><strong>Hóa đơn bán buôn riêng (ACL ngoài chuỗi)</strong><p>Hóa đơn không công khai. Chỉ ví tải lên và ví được cấp quyền mới đọc được khi dịch vụ tài liệu riêng được tích hợp.</p></div></div>
      <Card className="farmer-detail-invoice-card">
        {invoice ? (
          <>
            <div className="farmer-detail-invoice-head"><span className="farmer-detail-document-icon"><DetailIcon name="lock" /></span><div><h2>{invoice.name}</h2><p>{invoice.documentId} · gắn token #{batch.tokenId} · tệp được tạo khi tải · mô phỏng, chưa mã hóa</p></div></div>
            <div className="farmer-detail-invoice-preview"><span className="farmer-detail-watermark">XEM TRƯỚC</span><strong>Hóa đơn bán buôn số {invoice.number}</strong><p>Bên bán: {batch.farmId} · Lô {batch.code} · 1.000 kg dừa nguyên trái</p><p>Nội dung giả lập, không có giá trị pháp lý.</p><button type="button" className="button secondary" onClick={() => downloadPreviewInvoice(batch)}><TraceIcon name="download" /> Tải xuống (mô phỏng)</button></div>
          </>
        ) : <EmptyState title="Chưa có hóa đơn riêng" description="Chưa có tệp mẫu hoặc dịch vụ tài liệu riêng cho lô này." />}
      </Card>
      <Card className="farmer-detail-grants-card">
        <h2>Quản lý quyền truy cập</h2>
        <p>Chỉ uploader hợp lệ mới có thể cấp hoặc thu hồi quyền thật khi backend ACL sẵn sàng.</p>
        {invoice ? <div className="farmer-detail-grants-list">{(['Logistics', 'Retailer'] as const).map((actor) => <div key={actor} className="farmer-detail-grant-row"><span className="farmer-detail-wallet"><TraceIcon name="file" /><strong>{actor}</strong><small>Ví mẫu · chưa có địa chỉ</small></span><span>{grants[actor] ? 'Đã cấp quyền xem trước' : 'Chưa có quyền'}</span><button type="button" className={`button ${grants[actor] ? 'secondary' : ''}`} onClick={() => setGrants((current) => ({ ...current, [actor]: !current[actor] }))}>{grants[actor] ? 'Thu hồi' : 'Cấp quyền đọc'}</button></div>)}</div> : <EmptyState title="Chưa có dữ liệu quyền truy cập" />}
        {invoice && <p className="farmer-detail-grant-disclaimer">Thao tác chỉ đổi trạng thái mô phỏng trong trình duyệt; không gọi ACL, ký ví hoặc ghi Blockchain.</p>}
      </Card>
    </div>
  )
}

function JourneyPanel({ batch }: { batch: DemoBatch }) {
  return (
    <div className="farmer-detail-journey">
      <Card>
        <h2>Dòng thời gian vận hành (provenance)</h2>
        <TraceJourneyPanel events={farmerPreviewEvents(batch)} />
      </Card>
      <Card>
        <h2>Lịch sử sở hữu ERC-721</h2>
        <TraceNFTPanel ownership={batch.ownership} />
      </Card>
    </div>
  )
}

export function FarmerBatchDetailPage() {
  const { code: routeCode = '' } = useParams()
  const code = routeCode.trim().toUpperCase()
  const { session } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<TabId>('overview')
  const [mobileOpen, setMobileOpen] = useState<TabId | null>('overview')
  const [attempt, setAttempt] = useState(0)
  const [readState, setReadState] = useState<ReadState | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const preview = import.meta.env.DEV && session?.source === 'development-preview'
  const previewFarm = searchParams.get('previewFarm')
  const previewFarmId: PreviewFarmId | null = preview
    ? previewFarm === 'FARM-B' ? 'FARM-B' : previewFarm === 'none' ? null : 'FARM-A'
    : null
  const previewState = preview ? searchParams.get('previewState') : null
  const previewHost = preview ? document.getElementById('development-preview') : null
  const key = `${code}:${session?.wallet.address ?? 'none'}:${session?.source ?? 'none'}:${previewFarmId ?? 'none'}:${previewState ?? ''}:${attempt}`

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      farmerOverviewReader.read(session, preview ? previewFarmId : null, controller.signal).then(
        (result) => {
          if (!controller.signal.aborted) setReadState({ key, result: previewState === 'error' ? { kind: 'error' } : result })
        },
        () => {
          if (!controller.signal.aborted) setReadState({ key, result: { kind: 'error' } })
        },
      )
    }, 220)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [session, preview, previewFarmId, previewState, key])

  function changePreviewFarm(value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('previewFarm', value || 'none')
      return next
    })
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

  const result = readState?.key === key ? readState.result : null
  const demoBatch = getDemoBatch(code)
  const snapshot = result?.kind === 'ready' ? result.snapshot : null
  const farmerBatch = snapshot?.batches.find((item) => item.code === code)
  const consistent = snapshot && demoBatch && farmerBatch && demoBatch.tokenId === farmerBatch.tokenId
    && demoBatch.farmId === farmerBatch.farmId
    && demoBatch.harvestGroupId === farmerBatch.harvestGroupId
    && demoBatch.lifecycle === farmerBatch.lifecycle
    && demoBatch.owner === farmerBatch.ownerLabel
    && demoBatch.farmer === snapshot.farmerLabel
  const backPath = `/farmer/batches${preview ? `?previewFarm=${previewFarmId ?? 'none'}` : ''}`
  const renderPanel = (panel: TabId, batch: DemoBatch, record: FarmerOverviewBatch) => {
    switch (panel) {
      case 'overview': return <OverviewPanel batch={batch} farmerBatch={record} previewFarmId={previewFarmId} />
      case 'public': return <PublicDocumentsPanel batch={batch} />
      case 'private': return <PrivateDocumentsPanel key={batch.code} batch={batch} preview={preview} />
      case 'temperature': return <Card className="farmer-detail-section"><TraceTemperaturePanel batch={batch} /></Card>
      case 'journey': return <JourneyPanel batch={batch} />
      case 'qr': return <TraceQRCode code={batch.code} />
    }
  }

  return (
    <div className="farmer-detail-page">
      {previewHost && createPortal(
        <div className="farmer-detail-dev-field">
          <label htmlFor="farmer-detail-preview-farm">Xem trước nông trại (mô phỏng)</label>
          <select id="farmer-detail-preview-farm" value={previewFarmId ?? ''} onChange={(event) => changePreviewFarm(event.target.value)}>
            <option value="FARM-A">Farmer A · FARM-A</option>
            <option value="FARM-B">Farmer B · FARM-B</option>
            <option value="">Chưa có farmId</option>
          </select>
          <small>Chỉ đổi dữ liệu mẫu, không đổi ví hoặc farmId thật.</small>
        </div>,
        previewHost,
      )}

      <nav className="farmer-detail-breadcrumb" aria-label="Đường dẫn">
        <Link to={backPath}>Lô hàng</Link><span aria-hidden="true">›</span><span>{code || 'Chi tiết lô'}</span>
      </nav>

      {!result && session ? (
        <Card className="farmer-detail-feedback"><LoadingState label="Đang tải thông tin lô…" /></Card>
      ) : result?.kind === 'error' ? (
        <ErrorState title="Không thể đọc dữ liệu lô" description={previewState === 'error' ? 'Trạng thái lỗi mô phỏng; không phải sự cố RPC thật.' : 'Nguồn dữ liệu hiện chưa khả dụng.'} action={<button className="button" type="button" onClick={retry}>Thử lại</button>} />
      ) : result?.kind === 'unassigned' ? (
        <EmptyState title="Chưa có liên kết farmId" description="Chưa thể xác định các lô do Farmer hiện tại tạo từ dữ liệu đã tích hợp." />
      ) : result?.kind === 'ready' && !demoBatch ? (
        <ErrorState title="Không tìm thấy lô" description={`Không có lô mang mã ${code || 'được yêu cầu'} trong dữ liệu hiện có.`} action={<Link className="button" to={backPath}>Về Lô của tôi</Link>} />
      ) : result?.kind === 'ready' && !farmerBatch ? (
        <ErrorState title="Không có quyền xem lô này" description="Lô không thuộc phạm vi Farmer đang xem. Quyền truy cập quản lý không được suy ra từ chủ sở hữu NFT hiện tại." action={<Link className="button" to={backPath}>Về Lô của tôi</Link>} />
      ) : result?.kind === 'ready' && !consistent ? (
        <ErrorState title="Dữ liệu lô không nhất quán" description="Fixture Farmer và hồ sơ công khai chưa khớp. Không hiển thị chi tiết có thể gây hiểu nhầm." />
      ) : demoBatch && farmerBatch && consistent ? (
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
              {demoBatch.expiryDate && Date.now() >= Date.parse(demoBatch.expiryDate) && (
                <span className="farmer-detail-status farmer-detail-status-expired">Hết hạn</span>
              )}
              {demoBatch.recalled && (
                <span className="farmer-detail-status farmer-detail-status-recalled">Đã thu hồi</span>
              )}
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
            {TABS.map((item) => <section className="farmer-detail-accordion" key={item.id}>
              <h2><button type="button" aria-expanded={mobileOpen === item.id} aria-controls={`farmer-detail-mobile-${item.id}`} onClick={() => setMobileOpen((current) => current === item.id ? null : item.id)}><DetailIcon name={item.icon} />{item.label}<TraceIcon name="down" /></button></h2>
              {mobileOpen === item.id && <div id={`farmer-detail-mobile-${item.id}`} className="farmer-detail-accordion-content">{renderPanel(item.id, demoBatch, farmerBatch)}</div>}
            </section>)}
          </div>
        </>
      ) : null}
    </div>
  )
}
