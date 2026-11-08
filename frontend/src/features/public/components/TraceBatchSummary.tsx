import type { Lifecycle } from '../../../domain/types'
import type { DemoBatch } from '../mocks/traceDetailFixtures'
import { TraceIcon } from './TraceIcon'

const STEPS: { key: Lifecycle; label: string }[] = [
  { key: 'Created', label: 'Đã tạo' },
  { key: 'InTransit', label: 'Vận chuyển' },
  { key: 'Delivered', label: 'Đã giao' },
  { key: 'Sold', label: 'Đã bán' },
]

const STATUS_LABEL: Record<Lifecycle, string> = {
  Created: 'Created · Đã tạo',
  InTransit: 'InTransit · Đang vận chuyển',
  Delivered: 'Delivered · Đã giao',
  Sold: 'Sold · Đã bán',
}

function Field({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value || 'Chưa có dữ liệu'}</dd>
    </div>
  )
}

export function TraceBatchSummary({
  batch,
  recalled,
  expired,
}: {
  batch: DemoBatch
  recalled: boolean
  expired: boolean
}) {
  const currentIndex = STEPS.findIndex((step) => step.key === batch.lifecycle)
  return (
    <section className="trace-summary" aria-labelledby="trace-batch-code">
      <div className="trace-summary-image">
        <img
          src={batch.imageUrl ?? '/images/home/coconut-cluster.jpg'}
          alt={`Ảnh của lô ${batch.code}`}
          width="1024"
          height="1536"
        />
        <div className="trace-summary-image-shade" aria-hidden="true" />
        <div className="trace-summary-image-copy">
          <p>Lô dừa tươi · 1.000 kg · 1 NFT</p>
          <h1 id="trace-batch-code">{batch.code}</h1>
          {batch.imageUrl && <span>Ảnh gốc từ IPFS · SHA-256 khớp blockchain</span>}
        </div>
      </div>

      <div className="trace-summary-info">
        <div className="trace-summary-badges">
          <span className={`trace-status trace-status-${batch.lifecycle.toLowerCase()}`}>
            {STATUS_LABEL[batch.lifecycle]}
          </span>
          {expired && <span className="trace-status trace-status-expired">Hết hạn</span>}
          {recalled && <span className="trace-status trace-status-recalled">Đã thu hồi</span>}
        </div>
        <p className="trace-verification">
          <TraceIcon name="info" />
          <span>
            {batch.source === 'chain'
              ? batch.documents.every((d) => d.verified === 'match')
                ? 'Đã đối chiếu SHA-256 của cả 3 tệp công khai với hash trên blockchain: khớp.'
                : 'Chưa xác minh đủ 3 tệp công khai: xem tab Hồ sơ công khai để biết tệp nào chưa khớp hoặc chưa tải được.'
              : 'Chưa đối chiếu hash tệp công khai: fixture chưa có tệp gốc và SHA-256 chuẩn.'}
          </span>
        </p>
        <ol className="trace-stepper" aria-label="Vòng đời lô">
          {STEPS.map((step, index) => (
            <li
              key={step.key}
              className={
                index < currentIndex ? 'complete' : index === currentIndex ? 'current' : ''
              }
              aria-current={index === currentIndex ? 'step' : undefined}
            >
              <span className="trace-stepper-dot">
                {index < currentIndex ? <TraceIcon name="check" /> : index + 1}
              </span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
        <dl className="trace-summary-fields">
          <Field label="Trang trại" value={batch.farmId} mono />
          <Field label="Nhóm thu hoạch" value={batch.harvestGroupId} mono />
          <Field label="Vị trí nông trại" value={batch.farmLocation} />
          <Field label="Giống dừa" value={batch.variety} />
          <Field label="Ngày thu hoạch" value={batch.harvestDate} />
          <Field label="Hạn sử dụng" value={batch.expiryDate} />
          <Field label="Khối lượng" value="1.000 kg" />
          <Field
            label="Chủ sở hữu NFT"
            value={batch.source === 'chain' ? batch.owner : `${batch.owner} · chưa có địa chỉ ví`}
          />
        </dl>
      </div>
    </section>
  )
}
