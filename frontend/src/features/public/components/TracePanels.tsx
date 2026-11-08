import { DataTable, EmptyState } from '../../../components/ui'
import type { DemoBatch, DemoEvent, DemoOwnership, DemoReading } from '../mocks/traceDetailFixtures'
import { TraceIcon, type TraceIconName } from './TraceIcon'
import { TraceQRCode } from './TraceQRCode'

const EVENT_META: Record<DemoEvent['kind'], { label: string; icon: TraceIconName }> = {
  BatchCreated: { label: 'Khởi tạo lô và mint NFT', icon: 'leaf' },
  TransferAccepted: { label: 'Bàn giao đã xác nhận', icon: 'route' },
  TransitRecorded: { label: 'Bản ghi vận chuyển', icon: 'thermo' },
  BatchSold: { label: 'Đã bán', icon: 'store' },
  IncidentReported: { label: 'Báo cáo sự cố', icon: 'flag' },
  BatchRecalled: { label: 'Thu hồi lô', icon: 'warn' },
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

export function TraceJourneyPanel({ events, live = false }: { events: DemoEvent[]; live?: boolean }) {
  const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return (
    <div className="trace-journey-grid">
      <ol className="trace-timeline">
        {sorted.map((event) => (
          <li key={event.id}>
            <span className={`trace-timeline-dot trace-event-${event.kind.toLowerCase()}`}>
              <TraceIcon name={EVENT_META[event.kind].icon} />
            </span>
            <div>
              <h3>{EVENT_META[event.kind].label}</h3>
              <p>{event.detail}</p>
              <small>
                {formatDateTime(event.at)} · {live ? 'Thời gian block' : 'Thời gian'}
                {event.transactionHash ? (
                  <span className="mono"> · {event.transactionHash}</span>
                ) : null}
              </small>
            </div>
          </li>
        ))}
      </ol>
      <aside className="trace-journey-note">
        <TraceIcon name="info" />
        <div>
          <strong>Hành trình ≠ lịch sử NFT</strong>
          <p>
            Mỗi bàn giao chỉ là một bước (TransferAccepted và Transfer cùng một lần chuyển quyền).
            Lịch sử ERC-721 nằm ở tab riêng.
          </p>
        </div>
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
  const left = 72
  const right = 28
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
        aria-label={`Biểu đồ nhiệt độ theo thời gian: ${readings.map((reading) => `${reading.temperatureC} độ C`).join(', ')}`}
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
        {batch.minTemperatureC !== undefined && batch.maxTemperatureC !== undefined && (
          <text
            x={width - right - 4}
            y={y(batch.maxTemperatureC) - 5}
            textAnchor="end"
            className="trace-chart-threshold"
          >
            Ngưỡng {batch.minTemperatureC}–{batch.maxTemperatureC}°C
          </text>
        )}
        <path d={path} fill="none" stroke="var(--forest)" strokeWidth="3" strokeLinejoin="round" />
        {readings.map((reading, index) => {
          const out = isOutOfRange(reading, batch)
          return (
            <g key={reading.id}>
              {out ? (
                <path
                  d={`M${x(index)},${y(reading.temperatureC) - 11} l9,16 h-18z`}
                  fill="var(--danger)"
                />
              ) : (
                <circle
                  cx={x(index)}
                  cy={y(reading.temperatureC)}
                  r="5"
                  fill="var(--white)"
                  stroke="var(--forest)"
                  strokeWidth="2.5"
                />
              )}
              <text
                x={x(index)}
                y={y(reading.temperatureC) - 14}
                textAnchor="middle"
                className={out ? 'trace-chart-warning' : 'trace-chart-value'}
              >
                {reading.temperatureC}°C
              </text>
              <text x={x(index)} y={height - 14} textAnchor="middle" className="trace-chart-axis">
                #{reading.id}
              </text>
            </g>
          )
        })}
      </svg>
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
      <TemperatureChart batch={batch} />
      {exceeded.length > 0 && (
        <div className="trace-warning" role="alert">
          <strong>
            Vượt ngưỡng nhiệt độ:{' '}
            {exceeded.map((reading) => `${reading.temperatureC}°C`).join(', ')}
          </strong>
          <p>
            Đây là lần vượt ngưỡng trong dữ liệu; không tự động chứng minh lô mất an toàn thực
            phẩm.
          </p>
        </div>
      )}
      <DataTable
        columns={[
          {
            key: 'id',
            label: 'readingId',
            render: (reading: DemoReading) => <span className="mono">#{reading.id}</span>,
          },
          {
            key: 'time',
            label: 'observedAt (mẫu)',
            render: (reading: DemoReading) => formatDateTime(reading.observedAt),
          },
          {
            key: 'temperature',
            label: 'Nhiệt độ',
            render: (reading: DemoReading) => (
              <>
                {isOutOfRange(reading, batch) && (
                  <TraceIcon name="warn" className="trace-table-icon" />
                )}
                {reading.temperatureC.toFixed(1)}°C{' '}
                <small className="mono">({Math.round(reading.temperatureC * 100)} centi°C)</small>
              </>
            ),
          },
          {
            key: 'block',
            label: 'Thời điểm block ghi',
            render: () => 'Chưa có dữ liệu',
          },
          {
            key: 'location',
            label: 'Vị trí',
            render: (reading: DemoReading) => reading.location ?? 'Chưa có dữ liệu',
          },
          {
            key: 'transaction',
            label: 'txHash',
            render: (reading: DemoReading) => reading.transactionHash ?? 'Chưa có dữ liệu',
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

export function TraceNFTPanel({ ownership, live = false }: { ownership: DemoOwnership[]; live?: boolean }) {
  return (
    <div>
      <ol className="trace-ownership">
        {ownership.map((entry, index) => (
          <li key={entry.id}>
            <span className="trace-ownership-kind">
              {entry.kind === 'mint' ? 'Mint · Transfer #1' : `Transfer #${index + 1}`}
            </span>
            <strong className={entry.from === 'zero-address' ? 'mono' : undefined}>
              {actorLabel(entry.from)}
            </strong>
            <TraceIcon name="arrow" className="trace-ownership-arrow" />
            <strong>{actorLabel(entry.to)}</strong>
            <div className="trace-ownership-meta">
              <span>{formatDateTime(entry.at)}</span>
              <span className="mono">
                {entry.transactionHash ?? 'Chưa có txHash'}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="trace-panel-note">
        {live
          ? 'Mỗi dòng là một sự kiện Transfer (ERC-721) đọc từ hợp đồng. Mint bắt đầu từ zero-address.'
          : 'Mỗi dòng là một lần đổi chủ trong lịch sử ERC-721 mẫu. Mint bắt đầu từ zero-address. Không có giao dịch Sepolia thật để mở trên Etherscan.'}
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
            <div className="trace-document-heading">
              <span className="trace-document-icon">
                <TraceIcon
                  name={
                    document.name.endsWith('.pdf')
                      ? 'file'
                      : document.name.endsWith('.jpg')
                        ? 'image'
                        : 'json'
                  }
                />
              </span>
              <div>
                <h3>{document.name}</h3>
                <p>{document.label}</p>
              </div>
            </div>
            <div className="trace-document-ids">
              <span className="trace-document-id mono">
                CID: {document.cid ?? 'Chưa có dữ liệu'}
              </span>
              <span className="trace-document-id mono">
                SHA-256: {document.sha256 ?? 'Chưa có dữ liệu'}
              </span>
            </div>
            <span className="trace-document-status">
              <TraceIcon name="info" />{' '}
              {document.verified === 'match'
                ? 'SHA-256 của tệp tải về KHỚP hash trên blockchain'
                : document.verified === 'mismatch'
                  ? 'SHA-256 KHÔNG khớp hash trên blockchain: không coi là đã xác minh'
                  : document.verified === 'unavailable'
                    ? 'Không tải được tệp để đối chiếu SHA-256'
                    : 'Chưa đối chiếu SHA-256'}
            </span>
            {document.fileUrl ? (
              <a
                className="button secondary"
                href={document.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {batch.source === 'chain' ? 'Mở tệp gốc' : 'Mở tệp'}
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
      ? `${batch.minTemperatureC}–${batch.maxTemperatureC}°C`
      : undefined
  return (
    <div className="trace-technical-panel">
      <dl className="trace-technical-fields">
        <TechnicalField label="tokenId" value={`#${batch.tokenId}`} mono />
        <TechnicalField
          label={batch.source === 'chain' ? 'Mạng' : 'Mạng dự kiến'}
          value={batch.network ?? 'Ethereum Sepolia · 11155111 (chưa kết nối)'}
        />
        <TechnicalField label="Địa chỉ hợp đồng" value={batch.contractAddress} mono />
        <TechnicalField label="tokenURI" value={batch.tokenUri} mono />
        <TechnicalField label="Metadata CID" value={batch.metadataCid} mono />
        <TechnicalField label="Giống dừa" value={batch.variety} />
        <TechnicalField label="Phân bón" value={batch.fertilizer} />
        <TechnicalField label="Ngưỡng nhiệt độ" value={threshold} />
      </dl>
      <TraceQRCode
        code={batch.code}
        path={
          batch.source === 'chain' && batch.contractAddress
            ? `/trace/${batch.network?.split('· ')[1] ?? ''}/${batch.contractAddress}/${batch.tokenId}`
            : undefined
        }
      />
    </div>
  )
}
