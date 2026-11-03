import { DataTable, EmptyState } from '../../../components/ui'
import type { DemoBatch, DemoEvent, DemoOwnership, DemoReading } from '../mocks/traceDetailFixtures'
import { TraceQRCode } from './TraceQRCode'

const EVENT_LABELS: Record<DemoEvent['kind'], string> = {
  BatchCreated: 'Khởi tạo lô và mint NFT',
  TransferAccepted: 'Bàn giao đã xác nhận',
  TransitRecorded: 'Bản ghi vận chuyển',
  BatchSold: 'Đã bán',
  IncidentReported: 'Báo cáo sự cố',
  BatchRecalled: 'Thu hồi lô',
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function TraceJourneyPanel({ events }: { events: DemoEvent[] }) {
  const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return (
    <div className="trace-journey-grid">
      <ol className="trace-timeline">
        {sorted.map((event) => (
          <li key={event.id}>
            <span
              className={`trace-timeline-dot trace-event-${event.kind.toLowerCase()}`}
              aria-hidden="true"
            />
            <div>
              <h3>{EVENT_LABELS[event.kind]}</h3>
              <p>{event.detail}</p>
              <small>
                {formatDateTime(event.at)} · Thời gian mô phỏng
                {event.transactionHash ? (
                  <span className="mono"> · {event.transactionHash}</span>
                ) : null}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <aside className="trace-journey-note">
        <strong>Hành trình và NFT là hai lịch sử riêng</strong>
        <p>
          Một lần bàn giao chỉ xuất hiện một lần trong hành trình. Việc đổi chủ ERC-721 tương ứng
          được liệt kê ở tab Lịch sử NFT.
        </p>
      </aside>
    </div>
  )
}

function isOutOfRange(reading: DemoReading, batch: DemoBatch): boolean {
  return (
    (batch.minTemperatureC !== undefined && reading.temperatureC < batch.minTemperatureC) ||
    (batch.maxTemperatureC !== undefined && reading.temperatureC > batch.maxTemperatureC)
  )
}

function TemperatureChart({ batch }: { batch: DemoBatch }) {
  const readings = batch.readings
  const width = 640
  const height = 260
  const left = 48
  const right = 24
  const top = 20
  const bottom = 44
  const low = Math.min(4, ...readings.map((reading) => reading.temperatureC - 2))
  const high = Math.max(22, ...readings.map((reading) => reading.temperatureC + 2))
  const x = (index: number) =>
    left + (index / Math.max(readings.length - 1, 1)) * (width - left - right)
  const y = (value: number) => top + ((high - value) / (high - low)) * (height - top - bottom)
  const path = readings
    .map((reading, index) => `${index ? 'L' : 'M'}${x(index)} ${y(reading.temperatureC)}`)
    .join(' ')

  return (
    <figure className="trace-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Biểu đồ nhiệt độ mô phỏng theo thời gian: ${readings.map((reading) => `${reading.temperatureC} độ C`).join(', ')}`}
      >
        {batch.minTemperatureC !== undefined && batch.maxTemperatureC !== undefined && (
          <rect
            x={left}
            y={y(batch.maxTemperatureC)}
            width={width - left - right}
            height={y(batch.minTemperatureC) - y(batch.maxTemperatureC)}
            fill="var(--sage)"
            opacity="0.75"
          />
        )}
        {[4, 8, 12, 16, 20].map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" />
            <text x={left - 9} y={y(tick) + 4} textAnchor="end" className="trace-chart-axis">
              {tick}°
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--forest)" strokeWidth="3" strokeLinejoin="round" />
        {readings.map((reading, index) => {
          const out = isOutOfRange(reading, batch)
          return (
            <g key={reading.id}>
              <circle
                cx={x(index)}
                cy={y(reading.temperatureC)}
                r="6"
                fill={out ? 'var(--danger)' : 'var(--white)'}
                stroke={out ? 'var(--danger)' : 'var(--forest)'}
                strokeWidth="3"
              />
              <text
                x={x(index)}
                y={y(reading.temperatureC) - 14}
                textAnchor="middle"
                className={out ? 'trace-chart-warning' : 'trace-chart-value'}
              >
                {reading.temperatureC}°C
              </text>
              <text x={x(index)} y={height - 14} textAnchor="middle" className="trace-chart-axis">
                {formatTime(reading.observedAt)}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>
        Dữ liệu nhiệt độ và thời điểm quan sát là fixture mô phỏng, không phải đo từ thiết bị IoT
        thật. Vùng xanh là ngưỡng 8–15°C minh họa.
      </figcaption>
    </figure>
  )
}

export function TraceTemperaturePanel({ batch }: { batch: DemoBatch }) {
  if (!batch.readings.length) {
    return (
      <EmptyState
        title="Chưa có bản ghi vận chuyển"
        description="Fixture của lô này chưa có dữ liệu nhiệt độ để hiển thị."
      />
    )
  }
  const exceeded = batch.readings.filter((reading) => isOutOfRange(reading, batch))
  return (
    <div className="trace-temperature-panel">
      {exceeded.length > 0 && (
        <div className="trace-warning" role="alert">
          <strong>
            Vượt ngưỡng nhiệt độ:{' '}
            {exceeded.map((reading) => `${reading.temperatureC}°C`).join(', ')}
          </strong>
          <p>
            Đây là lần vượt ngưỡng trong dữ liệu mẫu; không tự động chứng minh lô mất an toàn thực
            phẩm.
          </p>
        </div>
      )}
      <TemperatureChart batch={batch} />
      <DataTable
        columns={[
          {
            key: 'id',
            label: 'readingId',
            render: (reading: DemoReading) => <span className="mono">#{reading.id}</span>,
          },
          {
            key: 'time',
            label: 'Thời điểm quan sát (mẫu)',
            render: (reading: DemoReading) => formatDateTime(reading.observedAt),
          },
          {
            key: 'temperature',
            label: 'Nhiệt độ',
            render: (reading: DemoReading) => `${reading.temperatureC.toFixed(1)}°C`,
          },
          {
            key: 'status',
            label: 'Trạng thái',
            render: (reading: DemoReading) =>
              isOutOfRange(reading, batch) ? (
                <span className="trace-table-warning">Vượt ngưỡng</span>
              ) : (
                'Trong ngưỡng'
              ),
          },
        ]}
        rows={batch.readings}
        keyOf={(reading) => String(reading.id)}
      />
    </div>
  )
}

function actorLabel(actor: DemoOwnership['from'] | DemoOwnership['to']): string {
  return actor === 'zero-address'
    ? '0x0000000000000000000000000000000000000000 (mint)'
    : `${actor} · chưa có địa chỉ ví`
}

export function TraceNFTPanel({ ownership }: { ownership: DemoOwnership[] }) {
  return (
    <div>
      <ol className="trace-ownership">
        {ownership.map((entry, index) => (
          <li key={entry.id}>
            <span className="trace-ownership-kind">
              {entry.kind === 'mint' ? 'Mint' : `Transfer #${index}`}
            </span>
            <div>
              <small>Từ ví</small>
              <strong className={entry.from === 'zero-address' ? 'mono' : undefined}>
                {actorLabel(entry.from)}
              </strong>
            </div>
            <span className="trace-ownership-arrow" aria-hidden="true">
              →
            </span>
            <div>
              <small>Đến ví</small>
              <strong>{actorLabel(entry.to)}</strong>
            </div>
            <div className="trace-ownership-meta">
              <span>{formatDateTime(entry.at)} · Mô phỏng</span>
              <span className="mono">
                {entry.transactionHash ?? 'Chưa có txHash trong fixture'}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="trace-panel-note">
        Mỗi dòng là một lần đổi chủ trong lịch sử ERC-721 mẫu. Mint bắt đầu từ zero-address. Không
        có giao dịch Sepolia thật để mở trên Etherscan.
      </p>
    </div>
  )
}

export function TraceDocumentsPanel({ batch }: { batch: DemoBatch }) {
  return (
    <div>
      <div className="trace-documents">
        {batch.documents.map((document) => (
          <article className="trace-document" key={document.name}>
            <div className="trace-document-icon" aria-hidden="true">
              {document.name.endsWith('.pdf')
                ? 'PDF'
                : document.name.endsWith('.jpg')
                  ? 'JPG'
                  : 'JSON'}
            </div>
            <h3>{document.name}</h3>
            <p>{document.label}</p>
            <dl>
              <div>
                <dt>CID</dt>
                <dd className="mono">{document.cid ?? 'Chưa có dữ liệu'}</dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd className="mono">{document.sha256 ?? 'Chưa có dữ liệu'}</dd>
              </div>
            </dl>
            <span className="trace-document-status">Chưa xác minh</span>
            {document.fileUrl ? (
              <a
                className="button secondary"
                href={document.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở tệp demo
              </a>
            ) : (
              <p className="trace-document-empty">Chưa có tệp để xem</p>
            )}
          </article>
        ))}
      </div>
      <p className="trace-panel-note">
        Hóa đơn bán buôn là tài liệu riêng và không xuất hiện tại trang công khai. Không thể xác
        minh SHA-256 khi thiếu tệp gốc và hash chuẩn.
      </p>
    </div>
  )
}

function TechnicalField({
  label,
  value,
  mono = false,
}: {
  label: string
  value?: string
  mono?: boolean
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value || 'Chưa có dữ liệu'}</dd>
    </div>
  )
}

export function TraceTechnicalPanel({ batch }: { batch: DemoBatch }) {
  const threshold =
    batch.minTemperatureC !== undefined && batch.maxTemperatureC !== undefined
      ? `${batch.minTemperatureC}–${batch.maxTemperatureC}°C (mẫu)`
      : undefined
  return (
    <div className="trace-technical-panel">
      <dl className="trace-technical-fields">
        <TechnicalField label="tokenId" value={`#${batch.tokenId}`} mono />
        <TechnicalField label="Mạng dự kiến" value="Ethereum Sepolia · 11155111 (chưa kết nối)" />
        <TechnicalField label="Địa chỉ hợp đồng" value={batch.contractAddress} mono />
        <TechnicalField label="tokenURI" value={batch.tokenUri} mono />
        <TechnicalField label="Metadata CID" value={batch.metadataCid} mono />
        <TechnicalField label="Giống dừa" value={batch.variety} />
        <TechnicalField label="Phân bón" value={batch.fertilizer} />
        <TechnicalField label="Ngưỡng nhiệt độ" value={threshold} />
      </dl>
      <TraceQRCode code={batch.code} />
    </div>
  )
}
