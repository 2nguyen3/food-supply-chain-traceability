import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { ExplorerLink } from '../public/components/ExplorerLink'
import { formatTime, shortHash } from './format'
import { useAdminChain } from './hooks/useAdminChain'
import { readAdminOverview } from './services/adminChain'
import './styles/overview.css'

function BatchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function IncidentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function RecallIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function RoleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 5.4a3.2 3.2 0 0 1 0 5.2M17.2 14.7c1.9.5 3.1 2 3.5 4.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function FarmIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export function AdminOverviewPage() {
  const loadOverview = useCallback((signal: AbortSignal) => readAdminOverview(signal), [])
  const { state, reload } = useAdminChain(loadOverview)

  const overview = state.kind === 'ready' ? state.data : null
  const kpis = [
    {
      label: 'Tổng số lô',
      value: overview ? String(overview.totalBatches) : '—',
      hint: overview ? `${overview.recalledBatches} lô đã thu hồi` : undefined,
      tone: 'green',
      icon: <BatchIcon />,
    },
    {
      label: 'Tổng sự cố',
      value: overview ? String(overview.totalIncidents) : '—',
      hint: 'Đọc từ event IncidentReported',
      tone: 'brown',
      icon: <IncidentIcon />,
    },
    {
      label: 'Sự cố chưa thu hồi',
      value: overview ? String(overview.openIncidents) : '—',
      hint: 'Lô của sự cố chưa bị thu hồi',
      tone: 'orange',
      icon: <IncidentIcon />,
    },
    {
      label: 'Lô đã thu hồi',
      value: overview ? String(overview.recalledBatches) : '—',
      hint: 'Trạng thái getBatch().recalled',
      tone: 'red',
      icon: <RecallIcon />,
    },
  ]

  return (
    <div className="overview-page">
      <PageHeader
        title="Tổng quan quản trị"
        description="Cấp role, gán farmId, điều tra sự cố và thu hồi từng lô. Số liệu và sự kiện đọc trực tiếp từ blockchain. Admin không có quyền mặc định với hóa đơn riêng."
      />

      {state.kind === 'loading' && <LoadingState label="Đang đọc tổng quan từ blockchain…" />}

      {state.kind === 'error' && (
        <ErrorState
          title="Không đọc được tổng quan"
          description={state.message}
          action={
            <Button type="button" onClick={reload}>
              Thử lại
            </Button>
          }
        />
      )}

      {overview && (
        <>
          <div className="overview-kpis">
            {kpis.map((kpi) => (
              <Card className="overview-kpi" key={kpi.label}>
                <span className={`overview-kpi-icon ${kpi.tone}`}>{kpi.icon}</span>
                <div>
                  <p className="overview-kpi-label">{kpi.label}</p>
                  <p className="overview-kpi-value">{kpi.value}</p>
                  {kpi.hint && <p className="overview-kpi-hint">{kpi.hint}</p>}
                </div>
              </Card>
            ))}
          </div>

          <div className="overview-actions">
            <Link className="overview-action" to="/admin/roles">
              <RoleIcon />
              Quản lý role
            </Link>
            <Link className="overview-action" to="/admin/farms">
              <FarmIcon />
              Gán farmId
            </Link>
            <Link className="overview-action" to="/admin/incidents">
              <IncidentIcon />
              Hộp thư sự cố
            </Link>
          </div>

          <Card className="overview-events">
            <h2>Sự kiện gần đây</h2>
            <div className="overview-table-scroll">
              <table className="overview-table">
                <tbody>
                  {overview.events.map((event) => (
                    <tr key={event.id}>
                      <td className="overview-event-time">{formatTime(event.at)}</td>
                      <td className="overview-event-batch">
                        {event.batchCode ? (
                          <Link to={`/admin/batches/${event.batchCode}`}>{event.batchCode}</Link>
                        ) : (
                          <span>#{event.tokenId ?? '—'}</span>
                        )}
                      </td>
                      <td className="overview-event-kind">
                        <span className="event-kind">{event.kind}</span>
                      </td>
                      <td className="overview-event-description">{event.detail}</td>
                      <td className="overview-event-tx">
                        <ExplorerLink kind="tx" value={event.txHash}>
                          {shortHash(event.txHash)}
                        </ExplorerLink>
                      </td>
                    </tr>
                  ))}
                  {overview.events.length === 0 && (
                    <tr>
                      <td colSpan={5} className="overview-event-description">
                        Chưa có sự kiện nào trên chain.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="admin-metrics" role="status">
            Đọc từ chain: {overview.events.length} sự kiện gần nhất · {overview.metrics.events}{' '}
            event · {overview.metrics.rpcCalls} RPC · {overview.metrics.durationMs} ms
          </p>
        </>
      )}
    </div>
  )
}
