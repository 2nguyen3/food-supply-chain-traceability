import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui'
import { LIFECYCLE_PILL, BATCH_ROWS } from './batchFixtures'
import { INCIDENTS } from './incidentFixtures'
import { useRecalls } from './incidentStore'
import './styles/incidents.css'

type IncidentFilter = 'all' | 'open' | 'recalled'

function shortAddress(address: string): string {
  return `${address.slice(0, 7)}...${address.slice(-4)}`
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
  const recalls = useRecalls()
  const [filter, setFilter] = useState<IncidentFilter>('all')

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address)
    } catch {
      // Bỏ qua nếu trình duyệt chặn clipboard.
    }
  }

  const rows = INCIDENTS.filter((incident) => {
    const recalled = !!recalls[incident.batchCode]
    if (filter === 'open') return !recalled
    if (filter === 'recalled') return recalled
    return true
  })

  return (
    <div className="incidents-page">
      <PageHeader
        title="Sự cố & thu hồi"
        description="Sự cố do Retailer báo cáo. Admin điều tra và thu hồi từng lô riêng, kèm lý do và bằng chứng."
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

      <section className="incidents-card" aria-label="Danh sách sự cố">
        <div className="incidents-table-wrap">
          <table className="incidents-table">
            <thead>
              <tr>
                <th>INCIDENTID</th>
                <th>LÔ</th>
                <th>NGƯỜI BÁO</th>
                <th>THỜI GIAN</th>
                <th>MÔ TẢ</th>
                <th>TRẠNG THÁI</th>
                <th aria-label="Hành động" />
              </tr>
            </thead>
            <tbody>
              {rows.map((incident) => {
                const recalled = !!recalls[incident.batchCode]
                const lifecycle = BATCH_ROWS.find(
                  (row) => row.code === incident.batchCode,
                )?.lifecycle
                return (
                  <tr key={incident.id}>
                    <td className="incidents-id-cell">
                      <Link className="incidents-id" to={`/admin/incidents/${incident.id}`}>
                        {incident.id}
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
                        <strong>{incident.reporter}</strong>
                        <span className="mono">{shortAddress(incident.reporterAddress)}</span>
                        <button
                          type="button"
                          className="incident-copy"
                          aria-label={`Sao chép địa chỉ ví ${incident.reporter}`}
                          title={`Sao chép địa chỉ ví ${incident.reporter}`}
                          onClick={() => copyAddress(incident.reporterAddress)}
                        >
                          <CopyIcon />
                        </button>
                      </span>
                    </td>
                    <td className="incidents-time-cell">{incident.time}</td>
                    <td className="incidents-desc-cell">{incident.description}</td>
                    <td>
                      <span className="incidents-status-cell">
                        {lifecycle && (
                          <span className={`batch-status ${lifecycle.toLowerCase()}`}>
                            {LIFECYCLE_PILL[lifecycle]}
                          </span>
                        )}
                        {recalled && (
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
                        to={`/admin/incidents/${incident.id}`}
                      >
                        Điều tra <span className="incidents-arrow">→</span>
                      </Link>
                    </td>
                  </tr>
                )
              })}
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
    </div>
  )
}
