import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { ipfsFileUrl } from '../public/services/publicChainReader'
import { formatTime, LIFECYCLE_PILL, shortAddress, shortCid } from './format'
import { useAdminChain } from './hooks/useAdminChain'
import { readAdminIncidents } from './services/adminChain'
import './styles/batches.css'
import './styles/incidents.css'

type IncidentFilter = 'all' | 'open' | 'recalled'

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

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

export function IncidentsPage() {
  const { showToast } = useToast()
  const loadIncidents = useCallback((signal: AbortSignal) => readAdminIncidents(signal), [])
  const { state, reload } = useAdminChain(loadIncidents)
  const [filter, setFilter] = useState<IncidentFilter>('all')

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  const incidents = state.kind === 'ready' ? state.data.incidents : []
  const rows = incidents.filter((incident) => {
    if (filter === 'open') return !incident.batchRecalled
    if (filter === 'recalled') return incident.batchRecalled
    return true
  })

  return (
    <div className="incidents-page">
      <PageHeader
        title="Sự cố & thu hồi"
        description="Sự cố đọc từ event IncidentReported, đối chiếu getIncident và getBatch. Admin điều tra và thu hồi từng lô riêng, kèm lý do và bằng chứng."
        actions={
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as IncidentFilter)}
            aria-label="Lọc sự cố theo trạng thái thu hồi"
          >
            <option value="all">Tất cả</option>
            <option value="open">Lô chưa thu hồi</option>
            <option value="recalled">Lô đã thu hồi</option>
          </select>
        }
      />

      {state.kind === 'loading' && (
        <section className="incidents-card">
          <LoadingState label="Đang đọc sự cố từ blockchain…" />
        </section>
      )}

      {state.kind === 'error' && (
        <ErrorState
          title="Không đọc được danh sách sự cố"
          description={state.message}
          action={
            <Button type="button" onClick={reload}>
              Thử lại
            </Button>
          }
        />
      )}

      {state.kind === 'ready' && (
        <>
          <section className="incidents-card" aria-label="Danh sách sự cố">
            <div className="incidents-table-wrap">
              <table className="incidents-table">
                <thead>
                  <tr>
                    <th>INCIDENTID</th>
                    <th>LÔ</th>
                    <th>NGƯỜI BÁO</th>
                    <th>THỜI GIAN</th>
                    <th>BÁO CÁO</th>
                    <th>TRẠNG THÁI</th>
                    <th aria-label="Hành động" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((incident) => (
                    <tr key={incident.incidentId}>
                      <td className="incidents-id-cell">
                        <Link
                          className="incidents-id"
                          to={`/admin/incidents/${incident.incidentId}`}
                        >
                          #{incident.incidentId}
                        </Link>
                      </td>
                      <td>
                        <div className="incidents-batch">
                          <Link to={`/admin/batches/${incident.batchCode}`}>
                            {incident.batchCode}
                          </Link>
                          <span>
                            {incident.farmId} / {incident.harvestGroupId}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="incidents-reporter">
                          <WalletIcon />
                          <span className="mono" title={incident.reporter}>
                            {shortAddress(incident.reporter)}
                          </span>
                          <button
                            type="button"
                            className="incident-copy"
                            aria-label={`Sao chép địa chỉ ví ${incident.reporter}`}
                            title="Sao chép địa chỉ người báo"
                            onClick={() =>
                              copyText(incident.reporter, 'Đã sao chép địa chỉ người báo')
                            }
                          >
                            <CopyIcon />
                          </button>
                        </span>
                      </td>
                      <td className="incidents-time-cell">{formatTime(incident.reportedAt)}</td>
                      <td>
                        <a
                          className="incidents-report-link mono"
                          href={ipfsFileUrl(incident.reportCid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Mở báo cáo trên IPFS: ${incident.reportCid}`}
                        >
                          {shortCid(incident.reportCid)}
                        </a>
                      </td>
                      <td>
                        <span className="incidents-status-cell">
                          <span className={`batch-status ${incident.lifecycle.toLowerCase()}`}>
                            {LIFECYCLE_PILL[incident.lifecycle]}
                          </span>
                          {incident.batchRecalled && (
                            <span className="batch-status recalled">
                              <WarningIcon />
                              Đã thu hồi
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="incidents-action-cell">
                        <Link
                          className="incidents-investigate"
                          to={`/admin/incidents/${incident.incidentId}`}
                        >
                          Điều tra <span className="incidents-arrow">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="incidents-empty">
                        Không có sự cố phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <p className="admin-metrics" role="status">
            Đọc từ chain: {incidents.length} sự cố · {state.data.metrics.events} event ·{' '}
            {state.data.metrics.rpcCalls} RPC · {state.data.metrics.durationMs} ms
          </p>
        </>
      )}
    </div>
  )
}
