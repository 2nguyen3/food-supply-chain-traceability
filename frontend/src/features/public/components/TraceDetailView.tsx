import { Link } from 'react-router-dom'
import type { DemoBatch } from '../mocks/traceDetailFixtures'
import { TraceBatchSummary } from './TraceBatchSummary'
import { TraceIcon } from './TraceIcon'
import {
  TraceDocumentsPanel,
  TraceJourneyPanel,
  TraceNFTPanel,
  TraceTechnicalPanel,
  TraceTemperaturePanel,
} from './TracePanels'
import { TraceSections, type TraceSection } from './TraceSections'
import '../styles/trace-detail.css'

/** Chi tiết truy xuất của một lô đọc từ blockchain thật (cùng bố cục với trang demo). */
export function TraceDetailView({ batch }: { batch: DemoBatch }) {
  const expired = batch.expiryDate ? Date.now() >= Date.parse(batch.expiryDate) : false
  const sections: TraceSection[] = [
    {
      id: 'journey',
      label: 'Hành trình lô',
      icon: 'route',
      content: <TraceJourneyPanel events={batch.events} live />,
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
      content: <TraceNFTPanel ownership={batch.ownership} wallets={batch.wallets} />,
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
          <strong>Dữ liệu đọc từ blockchain · {batch.network}</strong>
        </div>
        {batch.warnings?.map((warning) => (
          <div className="trace-alert trace-alert-expired" role="alert" key={warning}>
            <span className="trace-alert-icon">
              <TraceIcon name="warn" />
            </span>
            <div>
              <strong>Cảnh báo xác minh</strong>
              <p>{warning}</p>
            </div>
          </div>
        ))}
        {batch.recalled && (
          <div className="trace-alert trace-alert-recall" role="alert">
            <span className="trace-alert-icon">
              <TraceIcon name="warn" />
            </span>
            <div>
              <strong>Đã thu hồi</strong>
              <p>Không tiếp tục sử dụng hoặc bán lô này; liên hệ nơi mua để được hướng dẫn.</p>
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
                Trạng thái hết hạn hiển thị riêng với vòng đời và trạng thái thu hồi. Không nên sử
                dụng lô đã hết hạn.
              </p>
            </div>
          </div>
        )}
        <TraceBatchSummary batch={batch} recalled={batch.recalled} expired={expired} />
        <TraceSections sections={sections} />
      </div>
    </div>
  )
}
