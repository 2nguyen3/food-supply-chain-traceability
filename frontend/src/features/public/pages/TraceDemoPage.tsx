import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, ErrorState, LoadingState } from '../../../components/ui'
import { TraceBatchSummary } from '../components/TraceBatchSummary'
import {
  TraceDocumentsPanel,
  TraceJourneyPanel,
  TraceNFTPanel,
  TraceTechnicalPanel,
  TraceTemperaturePanel,
} from '../components/TracePanels'
import { getDemoBatch, type DemoEvent } from '../mocks/traceDetailFixtures'
import '../styles/trace-detail.css'

type PanelId = 'journey' | 'temperature' | 'nft' | 'documents' | 'technical'

export function TraceDemoPage() {
  const { code: routeCode = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const code = routeCode.trim().toUpperCase()
  const mockUnavailable = import.meta.env.DEV && searchParams.get('mockError') === 'unavailable'
  const previewFlags = import.meta.env.DEV ? (searchParams.get('preview') ?? '').split(',') : []
  const previewRecalled = previewFlags.includes('recalled')
  const previewExpired = previewFlags.includes('expired')
  const [attempt, setAttempt] = useState(0)
  const [resolved, setResolved] = useState({ code: '', attempt: -1, mockUnavailable: false })
  const [activeTab, setActiveTab] = useState<PanelId>('journey')
  const [openAccordions, setOpenAccordions] = useState<PanelId[]>(['journey'])

  useEffect(() => {
    const timer = window.setTimeout(() => setResolved({ code, attempt, mockUnavailable }), 350)
    return () => window.clearTimeout(timer)
  }, [code, attempt, mockUnavailable])

  function retry() {
    const next = new URLSearchParams(searchParams)
    next.delete('mockError')
    setSearchParams(next)
    setAttempt((current) => current + 1)
  }

  const loading =
    resolved.code !== code ||
    resolved.attempt !== attempt ||
    resolved.mockUnavailable !== mockUnavailable
  const batch = getDemoBatch(code)

  if (loading) {
    return (
      <div className="container trace-detail-feedback">
        <LoadingState label="Đang tải dữ liệu lô mô phỏng…" />
      </div>
    )
  }

  if (mockUnavailable) {
    return (
      <div className="container trace-detail-feedback">
        <ErrorState
          title="Dữ liệu demo tạm thời không khả dụng"
          description="Đây là lỗi mô phỏng trong môi trường phát triển, không phải sự cố RPC hoặc IPFS thật."
          action={
            <Button type="button" onClick={retry}>
              Thử lại
            </Button>
          }
        />
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="container trace-detail-feedback">
        <ErrorState
          title={`Không tìm thấy lô “${routeCode}”`}
          description="Mã này không có trong bốn fixture COCONUT-001 đến COCONUT-004."
          action={
            <Link className="button" to="/trace">
              Tra cứu lô khác
            </Link>
          }
        />
      </div>
    )
  }

  const recalled = batch.recalled || previewRecalled
  const expired =
    (batch.expiryDate ? Date.now() >= Date.parse(batch.expiryDate) : false) || previewExpired
  const events: DemoEvent[] = [...batch.events]
  if (previewRecalled) {
    events.push(
      {
        id: `${code}-preview-incident`,
        kind: 'IncidentReported',
        at: '2026-10-20T08:00:00+07:00',
        detail: 'Báo cáo sự cố trong chế độ xem trước trạng thái.',
      },
      {
        id: `${code}-preview-recall`,
        kind: 'BatchRecalled',
        at: '2026-10-21T08:00:00+07:00',
        detail: 'Thu hồi mô phỏng theo tham số URL; trạng thái gốc của fixture không đổi.',
      },
    )
  }

  const panels: { id: PanelId; label: string; content: ReactNode }[] = [
    { id: 'journey', label: 'Hành trình lô', content: <TraceJourneyPanel events={events} /> },
    {
      id: 'temperature',
      label: 'Nhiệt độ vận chuyển',
      content: <TraceTemperaturePanel batch={batch} />,
    },
    { id: 'nft', label: 'Lịch sử NFT', content: <TraceNFTPanel ownership={batch.ownership} /> },
    { id: 'documents', label: 'Hồ sơ công khai', content: <TraceDocumentsPanel batch={batch} /> },
    {
      id: 'technical',
      label: 'Thông số & blockchain',
      content: <TraceTechnicalPanel batch={batch} />,
    },
  ]

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % panels.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + panels.length) % panels.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = panels.length - 1
    else return
    event.preventDefault()
    setActiveTab(panels[next].id)
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[next]?.focus()
  }

  function toggleAccordion(id: PanelId) {
    setOpenAccordions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  return (
    <div className="trace-detail-page">
      <div className="container trace-detail-container">
        <div className="trace-detail-topline">
          <Link to="/trace">‹ Tra cứu lô khác</Link>
          <strong>Dữ liệu mô phỏng · không xác nhận trên Sepolia</strong>
        </div>

        {(previewRecalled || previewExpired) && (
          <p className="trace-preview-note">
            Đang xem trước trạng thái mô phỏng theo URL. Dữ liệu gốc của {code} không thay đổi.
          </p>
        )}
        {recalled && (
          <div className="trace-alert trace-alert-recall" role="alert">
            <strong>Đã thu hồi</strong>
            <p>
              Lô đang hiển thị trạng thái thu hồi. Không tiếp tục sử dụng hoặc bán lô này; liên hệ
              nơi mua để được hướng dẫn.
            </p>
            <small>Thu hồi không xóa trạng thái {batch.lifecycle} hay lịch sử NFT.</small>
          </div>
        )}
        {expired && (
          <div className="trace-alert trace-alert-expired" role="alert">
            <strong>Lô đã hết hạn sử dụng</strong>
            <p>
              Trạng thái hết hạn được hiển thị riêng với vòng đời và trạng thái thu hồi. Không nên
              sử dụng lô đã hết hạn.
            </p>
          </div>
        )}

        <TraceBatchSummary batch={batch} recalled={recalled} expired={expired} />

        <Card className="trace-desktop-panels">
          <div className="trace-tabs" role="tablist" aria-label="Nội dung truy xuất lô">
            {panels.map((panel, index) => (
              <button
                key={panel.id}
                id={`trace-tab-${panel.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === panel.id}
                aria-controls="trace-active-panel"
                tabIndex={activeTab === panel.id ? 0 : -1}
                onClick={() => setActiveTab(panel.id)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                {panel.label}
              </button>
            ))}
          </div>
          <div
            id="trace-active-panel"
            className="trace-tab-content"
            role="tabpanel"
            aria-labelledby={`trace-tab-${activeTab}`}
            tabIndex={0}
          >
            {panels.find((panel) => panel.id === activeTab)?.content}
          </div>
        </Card>

        <div className="trace-mobile-panels">
          {panels.map((panel) => {
            const open = openAccordions.includes(panel.id)
            return (
              <section className="trace-accordion" key={panel.id}>
                <h2>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`trace-accordion-${panel.id}`}
                    onClick={() => toggleAccordion(panel.id)}
                  >
                    {panel.label}
                    <span aria-hidden="true">{open ? '−' : '+'}</span>
                  </button>
                </h2>
                {open && (
                  <div id={`trace-accordion-${panel.id}`} className="trace-accordion-content">
                    {panel.content}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        <p className="trace-detail-disclaimer">
          Thông tin mô phỏng trên trang này không bảo đảm an toàn thực phẩm hoặc tính xác thực của
          chứng chỉ.
        </p>
      </div>
    </div>
  )
}
