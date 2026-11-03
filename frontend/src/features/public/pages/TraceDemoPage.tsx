import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, ErrorState, LoadingState } from '../../../components/ui'
import { TraceBatchSummary } from '../components/TraceBatchSummary'
import {
  TraceDocumentsPanel,
  TraceJourneyPanel,
  TraceNFTPanel,
  TraceTechnicalPanel,
  TraceTemperaturePanel,
} from '../components/TracePanels'
import { getDemoBatch, type DemoEvent } from '../mocks/traceDetailFixtures'
import { TraceSections, type TraceSection } from '../components/TraceSections'
import { TraceIcon } from '../components/TraceIcon'
import '../styles/trace-detail.css'

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

  const sections: TraceSection[] = [
    {
      id: 'journey',
      label: 'Hành trình lô',
      icon: 'route',
      content: <TraceJourneyPanel events={events} />,
    },
    {
      id: 'temperature',
      label: 'Nhiệt độ',
      mobileLabel: 'Nhiệt độ vận chuyển',
      icon: 'thermo',
      content: <TraceTemperaturePanel batch={batch} />,
    },
    {
      id: 'nft',
      label: 'Lịch sử NFT',
      mobileLabel: 'Lịch sử NFT (ERC-721)',
      icon: 'hash',
      content: <TraceNFTPanel ownership={batch.ownership} />,
    },
    {
      id: 'documents',
      label: 'Hồ sơ công khai',
      mobileLabel: 'Chứng chỉ & hồ sơ công khai',
      icon: 'file',
      content: <TraceDocumentsPanel batch={batch} />,
    },
    {
      id: 'technical',
      label: 'Thông số & blockchain',
      icon: 'link',
      content: <TraceTechnicalPanel batch={batch} />,
    },
  ]

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
            <span className="trace-alert-icon">
              <TraceIcon name="warn" />
            </span>
            <div>
              <strong>Đã thu hồi</strong>
              <p>
                Lô đang hiển thị trạng thái thu hồi. Không tiếp tục sử dụng hoặc bán lô này; liên hệ
                nơi mua để được hướng dẫn.
              </p>
              <small>Thu hồi không xóa trạng thái {batch.lifecycle} hay lịch sử NFT.</small>
            </div>
          </div>
        )}
        {expired && (
          <div className="trace-alert trace-alert-expired" role="alert">
            <span className="trace-alert-icon">
              <TraceIcon name="warn" />
            </span>
            <div>
              <strong>Lô đã hết hạn sử dụng</strong>
              <p>
                Trạng thái hết hạn được hiển thị riêng với vòng đời và trạng thái thu hồi. Không nên
                sử dụng lô đã hết hạn.
              </p>
            </div>
          </div>
        )}

        <TraceBatchSummary batch={batch} recalled={recalled} expired={expired} />

        <TraceSections sections={sections} />

        <p className="trace-detail-disclaimer">
          Thông tin mô phỏng trên trang này không bảo đảm an toàn thực phẩm hoặc tính xác thực của
          chứng chỉ.
        </p>
      </div>
    </div>
  )
}
