import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Modal, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { JOURNEY_EVENTS, LIFECYCLE_PILL, READINGS, type JourneyEvent } from './batchFixtures'
import {
  CLASSIFICATION_LABEL,
  RELATED_BATCHES,
  RECALL_REASON_CID,
  RECALL_SCOPE,
  RECALL_TIME,
  RECALL_TX_HASH,
  TEMP_NOTE_TEXT,
  TEMP_OVER_TEXT,
  getIncident,
} from './incidentFixtures'
import { INCIDENT_WARNING_TEXT } from './incidentFixtures'
import { recordRecall, useRecalls } from './incidentStore'
import { TemperatureChart } from './TemperatureChart'
import { TxProgressModal } from './TxProgressModal'
import './styles/roles.css'
import './styles/batches.css'
import './styles/incidents.css'

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}

function shortCid(cid: string): string {
  return `${cid.slice(0, 12)}...${cid.slice(-6)}`
}

function shortAddress(address: string): string {
  return `${address.slice(0, 7)}...${address.slice(-4)}`
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

function AlertIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m6 18.5 11.5-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 3 5 13.5h5.5L10 21l8-10.5h-5.5L13 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 10.5v6M12 7.5h.01"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
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
      className="incident-copy"
      onClick={copy}
      aria-label={message}
      title={message}
    >
      <CopyIcon />
    </button>
  )
}

function WalletChip({
  label,
  address,
  copyMessage,
}: {
  label?: string
  address: string
  copyMessage: string
}) {
  return (
    <span className="incident-wallet-chip">
      <WalletIcon />
      {label && <strong>{label}</strong>}
      <span className="mono">{shortAddress(address)}</span>
      <CopyButton text={address} message={copyMessage} />
    </span>
  )
}

interface RecallProgress {
  code: string
  lifecycle: string
  reason: string
  reasonCid: string
}

export function IncidentDetailPage() {
  const { id = '' } = useParams()
  const incident = getIncident(id)
  const recalls = useRecalls()
  const { showToast } = useToast()
  const [recallCode, setRecallCode] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [reasonCid, setReasonCid] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<RecallProgress | null>(null)
  const uploadTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (uploadTimer.current) window.clearTimeout(uploadTimer.current)
    },
    [],
  )

  if (!incident) {
    return (
      <div className="incidents-page">
        <PageHeader
          title="Không tìm thấy sự cố"
          description="Mã sự cố không tồn tại trong dữ liệu demo."
          crumbs={[{ label: 'Sự cố', to: '/admin/incidents' }]}
        />
        <Link className="button" to="/admin/incidents">
          Quay lại danh sách sự cố
        </Link>
      </div>
    )
  }

  const related = RELATED_BATCHES[incident.id] ?? []

  function recalledRow(code: string) {
    return recalls[code]
  }

  function statusCell(lifecycle: string, code: string) {
    const recalled = recalledRow(code)
    return (
      <span className="incident-status-group">
        <span className={`batch-status ${lifecycle.toLowerCase()}`}>
          {LIFECYCLE_PILL[lifecycle as keyof typeof LIFECYCLE_PILL]}
        </span>
        {recalled && (
          <span className="batch-status recalled">
            <AlertIcon size={14} />
            Đã thu hồi
          </span>
        )}
      </span>
    )
  }

  function actionCell(code: string, classification: string, recalled: (typeof recalls)[string]) {
    if (classification === 'control') {
      return <span className="incident-no-action">Không thuộc nhóm khớp, không tự thu hồi</span>
    }
    if (recalled) {
      return (
        <span className="incident-action-done">
          <span className="incident-done-label">
            <CheckIcon />
            Đã thu hồi
          </span>
          <span className="incident-done-tx">
            <span className="mono">{shortHash(recalled.txHash)}</span>
            <CopyButton text={recalled.txHash} message="Đã sao chép mã giao dịch" />
          </span>
        </span>
      )
    }
    return (
      <Button variant="danger" className="incident-recall-btn" onClick={() => openRecall(code)}>
        <BanIcon />
        Thu hồi lô này
      </Button>
    )
  }

  function openRecall(code: string) {
    setRecallCode(code)
    setReason('')
    setReasonCid('')
    setUploading(false)
  }

  function closeRecall() {
    if (uploadTimer.current) window.clearTimeout(uploadTimer.current)
    setUploading(false)
    setRecallCode(null)
  }

  function uploadReason() {
    if (!reason.trim()) return
    setUploading(true)
    uploadTimer.current = window.setTimeout(() => {
      setReasonCid(RECALL_REASON_CID)
      setUploading(false)
      showToast('Đã tải lý do lên IPFS (mô phỏng)', 'success')
    }, 700)
  }

  const trimmedReason = reason.trim()
  const reasonValid = trimmedReason.length >= 10

  function startRecall() {
    if (!recallCode || !reasonValid) return
    const lifecycleRow = related.find((row) => row.code === recallCode)
    setProgress({
      code: recallCode,
      lifecycle: lifecycleRow?.lifecycle ?? 'Sold',
      reason: trimmedReason,
      reasonCid: reasonCid || RECALL_REASON_CID,
    })
    setRecallCode(null)
  }

  function finishRecall() {
    if (!progress || !incident) return
    recordRecall({
      batchCode: progress.code,
      incidentId: incident.id,
      reason: progress.reason,
      reasonCid: progress.reasonCid,
      txHash: RECALL_TX_HASH,
      time: RECALL_TIME,
      scope: RECALL_SCOPE,
    })
    showToast(`Đã thu hồi ${progress.code}`, 'success')
    setProgress(null)
  }

  const recalledPrimary = recalledRow(incident.batchCode)

  const journey: JourneyEvent[] = [...JOURNEY_EVENTS]
  journey.push({
    id: `incident-${incident.id}`,
    kind: 'incident',
    title: 'Báo cáo sự cố',
    description: `${incident.reporter} báo cáo sự cố ${incident.id}`,
    time: incident.time,
    txHash: incident.reportTx,
  })
  if (recalledPrimary) {
    journey.push({
      id: `recall-${recalledPrimary.batchCode}`,
      kind: 'recall',
      title: 'Thu hồi lô',
      description: `Admin thu hồi lô theo sự cố ${incident.id}`,
      time: recalledPrimary.time,
      txHash: recalledPrimary.txHash,
    })
  }

  return (
    <div className="incidents-page incident-detail-page">
      <PageHeader
        title={`Điều tra ${incident.id}`}
        description="Ứng viên khớp theo farmId và harvestGroupId chỉ để điều tra, không phải bằng chứng nhiễm bẩn. Thu hồi từng lô một."
        crumbs={[{ label: 'Sự cố', to: '/admin/incidents' }, { label: incident.id }]}
      />

      <div className="incident-head-pills">
        <span className="batch-status sold">{LIFECYCLE_PILL.Sold}</span>
        {recalledPrimary && (
          <span className="batch-status recalled">
            <AlertIcon size={14} />
            Đã thu hồi
          </span>
        )}
      </div>

      <div className="incident-detail">
        <div className="incident-main">
          <section className="batch-card incident-report">
            <div className="incident-card-head">
              <h2>Báo cáo của Retailer</h2>
              <span className="batch-tx">
                tx <span className="mono">{shortHash(incident.reportTx)}</span>
                <CopyButton text={incident.reportTx} message="Đã sao chép mã giao dịch" />
              </span>
            </div>

            <p className="incident-banner">{incident.description}</p>

            <div className="incident-meta-grid">
              <div>
                <span>Lô</span>
                <strong>
                  <Link to={`/admin/batches/${incident.batchCode}`}>
                    {incident.batchCode} · #{incident.tokenId}
                  </Link>
                </strong>
              </div>
              <div>
                <span>Người báo</span>
                <WalletChip
                  label={incident.reporter}
                  address={incident.reporterAddress}
                  copyMessage="Đã sao chép địa chỉ ví"
                />
              </div>
              <div>
                <span>Thời gian</span>
                <strong>{incident.time}</strong>
              </div>
              <div>
                <span>Farmer</span>
                <WalletChip address={incident.farmerAddress} copyMessage="Đã sao chép địa chỉ ví" />
              </div>
              <div>
                <span>farmId</span>
                <strong>{incident.farmId}</strong>
              </div>
              <div>
                <span>harvestGroupId</span>
                <strong>{incident.harvestGroupId}</strong>
              </div>
            </div>

            <div className="incident-evidence">
              <h3>Bằng chứng</h3>
              {incident.evidence.map((file) => (
                <div className="incident-evidence-row" key={file.name}>
                  <span className="incident-evidence-label">{file.label}</span>
                  <div className="incident-evidence-body">
                    <strong className="mono">{file.name}</strong>
                    <span className="incident-hash-chip">
                      CID <span className="mono">{file.shortCid}</span>
                      <CopyButton text={file.cid} message="Đã sao chép CID" />
                    </span>
                    <span className="incident-hash-chip">
                      SHA-256 <span className="mono">{file.shortSha}</span>
                      <CopyButton text={file.sha256} message="Đã sao chép SHA-256" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="batch-card incident-related">
            <div className="incident-card-head">
              <div>
                <h2>Truy ngược lô liên quan</h2>
                <p className="incident-sub">
                  Ứng viên: cùng <strong>{incident.farmId}</strong> và cùng{' '}
                  <strong>{incident.harvestGroupId}</strong>. Các lô khác là đối chứng.
                </p>
              </div>
            </div>

            <div className="incident-table-wrap">
              <table className="incident-table">
                <thead>
                  <tr>
                    <th>LÔ</th>
                    <th>FARM / NHÓM</th>
                    <th>PHÂN LOẠI</th>
                    <th>TRẠNG THÁI</th>
                    <th>HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {related.map((row) => {
                    const recalled = recalledRow(row.code)
                    return (
                      <tr key={row.code} className={recalled ? 'recalled-row' : ''}>
                        <td>
                          <Link className="incident-batch-link" to={`/admin/batches/${row.code}`}>
                            {row.code}
                          </Link>
                        </td>
                        <td className="incident-farmcell">
                          {row.farmId} / {row.groupId}
                        </td>
                        <td>
                          <span className={`incident-class ${row.classification}`}>
                            {CLASSIFICATION_LABEL[row.classification]}
                          </span>
                          <span className="incident-class-note">{row.note}</span>
                        </td>
                        <td>{statusCell(row.lifecycle, row.code)}</td>
                        <td>{actionCell(row.code, row.classification, recalled)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="incident-warning">
            <span className="incident-warning-icon">
              <AlertIcon size={22} />
            </span>
            <div>
              <strong>Lưu ý khi thu hồi</strong>
              <p>{INCIDENT_WARNING_TEXT}</p>
            </div>
          </div>
        </div>

        <aside className="incident-side">
          <section className="batch-card incident-recall-status">
            <h2>Trạng thái thu hồi</h2>
            {recalledPrimary ? (
              <>
                <span className="batch-status recalled">
                  <AlertIcon size={14} />
                  Đã thu hồi
                </span>
                <div className="incident-recall-meta">
                  <div>
                    <span>Thời gian</span>
                    <strong>{recalledPrimary.time}</strong>
                  </div>
                  <div>
                    <span>Giao dịch</span>
                    <span className="batch-tx">
                      <span className="mono">{shortHash(recalledPrimary.txHash)}</span>
                      <CopyButton
                        text={recalledPrimary.txHash}
                        message="Đã sao chép mã giao dịch"
                      />
                    </span>
                  </div>
                  <div>
                    <span>Lý do thu hồi</span>
                    <p>{recalledPrimary.reason}</p>
                  </div>
                  <div>
                    <span>CID lý do (IPFS)</span>
                    <span className="incident-hash-chip">
                      <span className="mono">{shortCid(recalledPrimary.reasonCid)}</span>
                      <CopyButton text={recalledPrimary.reasonCid} message="Đã sao chép CID" />
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="batch-status incident-recall-pending">Chưa thu hồi</span>
                <p className="incident-recall-note">
                  Thu hồi từng lô, lý do tối thiểu 10 ký tự; không xoá lịch sử sự kiện hay quyền sở
                  hữu NFT.
                </p>
              </>
            )}
          </section>
        </aside>

        <section className="batch-card batch-timeline incident-timeline">
          <h2>Hành trình của {incident.batchCode}</h2>
          <ol>
            {journey.map((event) => (
              <li key={event.id} className={`journey-item ${event.kind}`}>
                <span className="journey-icon">
                  {event.kind === 'mint' && <LeafIcon />}
                  {event.kind === 'handoff' && <TruckIcon />}
                  {event.kind === 'reading' && <ThermometerIcon />}
                  {event.kind === 'sold' && <StoreIcon />}
                  {event.kind === 'incident' && <FlagIcon />}
                  {event.kind === 'recall' && <AlertIcon size={17} />}
                </span>
                <div className="journey-body">
                  <strong>{event.title}</strong>
                  <p>{event.description}</p>
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
      </div>

      <section className="incident-temp-section">
        <div className="incident-temp-col">
          <section className="batch-card incident-temp-card">
            <h2>Nhiệt độ vận chuyển</h2>
            <TemperatureChart readings={READINGS} min={8} max={15} />
            <p className="incident-temp-note">{TEMP_NOTE_TEXT}</p>
          </section>

          <section className="batch-card incident-over-temp">
            <div className="incident-over-temp-head">
              <span className="incident-over-temp-icon">
                <AlertIcon size={20} />
              </span>
              <div>
                <strong>Vượt ngưỡng nhiệt độ: 18°C</strong>
                <p>{TEMP_OVER_TEXT}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="batch-card incident-readings">
          <div className="incident-readings-wrap">
            <table className="incident-readings-table">
              <thead>
                <tr>
                  <th>READINGID</th>
                  <th>NHIỆT ĐỘ</th>
                  <th>OBSERVEDAT (THỜI ĐIỂM)</th>
                </tr>
              </thead>
              <tbody>
                {READINGS.map((reading) => (
                  <tr key={reading.id} className={reading.over ? 'over' : ''}>
                    <td className="mono">#{reading.id}</td>
                    <td>
                      {reading.over && (
                        <span className="incident-reading-flag">
                          <AlertIcon size={14} />
                        </span>
                      )}
                      <span className={`incident-reading-temp${reading.over ? ' over' : ''}`}>
                        {reading.temperatureC.toFixed(1)}°C
                      </span>
                      <span className="incident-reading-centi">
                        ({reading.centiC} centi°C)
                        {reading.over && ' · vượt ngưỡng'}
                      </span>
                    </td>
                    <td>
                      <span>{reading.observedAt}</span>
                      <em>{reading.location}</em>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <Modal
        open={!!recallCode}
        onClose={closeRecall}
        title={`Thu hồi ${recallCode ?? ''}`}
        className="roles-modal recall-modal"
        footer={
          <div className="recall-foot">
            <div className="recall-foot-actions">
              <Button variant="secondary" onClick={closeRecall}>
                Hủy
              </Button>
              <Button variant="danger" onClick={startRecall} disabled={!reasonValid}>
                <BoltIcon />
                Xem lại &amp; ký recallBatch
              </Button>
            </div>
            {!reasonValid && (
              <span className="recall-error">
                <InfoIcon />
                Lý do thu hồi cần ít nhất 10 ký tự.
              </span>
            )}
          </div>
        }
      >
        <div className="recall-pills">
          <span className="batch-status sold">{LIFECYCLE_PILL.Sold}</span>
          <strong className="recall-incident-id">incidentId {incident.id}</strong>
        </div>

        <div className="recall-form">
          <label htmlFor="recall-reason">Lý do thu hồi</label>
          <textarea
            id="recall-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Cùng farmId FARM-A và nhóm HG-A01 với lô có sự cố, thu hồi để điều tra thêm."
            rows={4}
          />
          <span className="recall-hint">Ít nhất 10 ký tự. Lý do sẽ được băm và tải lên IPFS.</span>

          <div className="recall-ipfs">
            <Button
              variant="secondary"
              onClick={uploadReason}
              disabled={!trimmedReason || uploading}
            >
              <span className="recall-ipfs-hash">#</span>
              {uploading ? 'Đang tải lên IPFS (mô phỏng)...' : 'Tải lý do lên IPFS (mô phỏng)'}
            </Button>
            {reasonCid && (
              <span className="recall-cid">
                CID <span className="mono">{shortCid(reasonCid)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="recall-scope">
          <span className="recall-scope-icon">
            <AlertIcon size={20} />
          </span>
          <div>
            <strong>Phạm vi: chỉ lô này</strong>
            <p>
              Các lô khác (kể cả ứng viên cùng nhóm) không bị ảnh hưởng. Trạng thái Sold và chủ sở
              hữu NFT được giữ nguyên.
            </p>
          </div>
        </div>
      </Modal>

      <TxProgressModal
        open={!!progress}
        onClose={() => setProgress(null)}
        title={`Thu hồi ${progress?.code ?? ''}`}
        className="recall-progress"
        method="recallBatch()"
        summary={
          progress
            ? [
                { label: 'Lô', value: `${progress.code} (${progress.lifecycle})` },
                { label: 'incidentId', value: incident.id },
                { label: 'Phạm vi', value: RECALL_SCOPE },
              ]
            : []
        }
        txHash={RECALL_TX_HASH}
        onFinish={finishRecall}
      />
    </div>
  )
}
