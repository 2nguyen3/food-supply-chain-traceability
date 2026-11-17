import { lazy, Suspense } from 'react'
import { DataTable, EmptyState, LoadingState } from '../../../components/ui'
import type { DemoBatch, DemoEvent, DemoOwnership, DemoReading } from '../mocks/traceDetailFixtures'
import { ExplorerLink } from './ExplorerLink'
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
              {event.attachment && (
                <a
                  className="trace-event-attachment"
                  href={event.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TraceIcon name="file" /> {event.attachment.label}
                </a>
              )}
              <small>
                {formatDateTime(event.at)} · {live ? 'Thời gian block' : 'Thời gian'}
                {event.transactionHash ? (
                  <>
                    {' · '}
                    <ExplorerLink kind="tx" value={event.transactionHash} />
                  </>
                ) : null}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function isOutOfRange(reading: DemoReading, batch: DemoBatch): boolean {
  return (
    (batch.minTemperatureC !== undefined && reading.temperatureC < batch.minTemperatureC) ||
    (batch.maxTemperatureC !== undefined && reading.temperatureC > batch.maxTemperatureC)
  )
}

const TemperatureChart = lazy(() => import('./TemperatureChart'))

export function TraceTemperaturePanel({ batch }: { batch: DemoBatch }) {
  if (!batch.readings.length) {
    return (
      <EmptyState
        title="Chưa có bản ghi vận chuyển"
        description="Lô này chưa có bản ghi nhiệt độ từ thiết bị vận chuyển."
      />
    )
  }
  const exceeded = batch.readings.filter((reading) => isOutOfRange(reading, batch))
  return (
    <div className="trace-temperature-panel">
      <Suspense fallback={<LoadingState label="Đang tải biểu đồ…" />}>
        <TemperatureChart batch={batch} />
      </Suspense>
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
            label: 'Mã bản ghi',
            render: (reading: DemoReading) => <span className="mono">#{reading.id}</span>,
          },
          {
            key: 'time',
            label: 'Thời điểm quan sát',
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
                {reading.temperatureC.toFixed(1)}°C
              </>
            ),
          },
          {
            key: 'block',
            label: 'Thời điểm block ghi',
            render: (reading: DemoReading) =>
              reading.blockTime ? formatDateTime(reading.blockTime) : 'Chưa có dữ liệu',
          },
          {
            key: 'location',
            label: 'Vị trí',
            render: (reading: DemoReading) => reading.location ?? 'Chưa có dữ liệu',
          },
          {
            key: 'transaction',
            label: 'txHash',
            render: (reading: DemoReading) =>
              reading.transactionHash ? (
                <ExplorerLink kind="tx" value={reading.transactionHash} />
              ) : (
                'Chưa có dữ liệu'
              ),
          },
        ]}
        rows={batch.readings}
        keyOf={(reading) => String(reading.id)}
      />
    </div>
  )
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function Actor({
  actor,
  wallets,
}: {
  actor: DemoOwnership['from'] | DemoOwnership['to']
  wallets?: Record<string, string>
}) {
  if (actor === 'zero-address') return <>{ZERO_ADDRESS} (mint)</>
  const address = wallets?.[actor]
  if (!address) return <>{`${actor} · chưa có địa chỉ ví`}</>
  return (
    <ExplorerLink kind="address" value={address} className="">
      {actor}
    </ExplorerLink>
  )
}

export function TraceNFTPanel({
  ownership,
  wallets,
}: {
  ownership: DemoOwnership[]
  wallets?: Record<string, string>
}) {
  return (
    <div>
      <ol className="trace-ownership">
        {ownership.map((entry, index) => (
          <li key={entry.id}>
            <span className="trace-ownership-kind">
              {entry.kind === 'mint' ? 'Mint · Transfer #1' : `Transfer #${index + 1}`}
            </span>
            <strong className={entry.from === 'zero-address' ? 'mono' : undefined}>
              <Actor actor={entry.from} wallets={wallets} />
            </strong>
            <TraceIcon name="arrow" className="trace-ownership-arrow" />
            <strong>
              <Actor actor={entry.to} wallets={wallets} />
            </strong>
            <div className="trace-ownership-meta">
              <span>{formatDateTime(entry.at)}</span>
              {entry.transactionHash ? (
                <ExplorerLink kind="tx" value={entry.transactionHash} />
              ) : (
                <span className="mono">Chưa có txHash</span>
              )}
            </div>
          </li>
        ))}
      </ol>
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
              {document.cid && (
                <span className="trace-document-id mono">ipfs://{document.cid}</span>
              )}
              {document.fileUrl && (
                <span className="trace-document-id mono">URL gateway: {document.fileUrl}</span>
              )}
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
    </div>
  )
}

function TechnicalField({
  label,
  value,
  mono = false,
  link,
}: {
  label: string
  value?: string
  mono?: boolean
  link?: 'tx' | 'address'
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>
        {value && link ? <ExplorerLink kind={link} value={value} /> : value || 'Chưa có dữ liệu'}
      </dd>
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
        <TechnicalField label="Địa chỉ hợp đồng" value={batch.contractAddress} mono link="address" />
        <TechnicalField label="Chủ sở hữu hiện tại" value={batch.ownerAddress} mono link="address" />
        <TechnicalField label="Farmer tạo lô" value={batch.farmerAddress} mono link="address" />
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
