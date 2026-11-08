import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../../components/ui'
import { INCIDENTS } from './incidentFixtures'
import { useRecalls } from './incidentStore'
import './styles/overview.css'

interface OverviewEvent {
  time: string
  batch: string
  kind: string
  description: string
}

const EVENTS: OverviewEvent[] = [
  {
    time: '08:30 02/11/2026',
    batch: 'COCONUT-004',
    kind: 'BatchCreated',
    description: 'Khởi tạo NFT cho lô COCONUT-004, 1.000 kg',
  },
  {
    time: '09:00 28/10/2026',
    batch: 'COCONUT-003',
    kind: 'TransferAccepted',
    description: 'Retailer xác nhận nhận lô; chủ sở hữu NFT chuyển sang Retailer',
  },
  {
    time: '14:24 27/10/2026',
    batch: 'COCONUT-003',
    kind: 'TransitRecorded',
    description: 'Bản ghi nhiệt độ #5: 11.0°C tại Kho lạnh Thủ Đức',
  },
  {
    time: '13:23 27/10/2026',
    batch: 'COCONUT-003',
    kind: 'TransitRecorded',
    description: 'Bản ghi nhiệt độ #4: 12.0°C tại Cửa ngõ TP.HCM',
  },
  {
    time: '12:22 27/10/2026',
    batch: 'COCONUT-003',
    kind: 'TransitRecorded',
    description: 'Bản ghi nhiệt độ #3: 12.0°C tại Trạm trung chuyển Long An',
  },
  {
    time: '11:21 27/10/2026',
    batch: 'COCONUT-003',
    kind: 'TransitRecorded',
    description: 'Bản ghi nhiệt độ #2: 11.0°C tại QL60, Tiền Giang',
  },
  {
    time: '10:20 27/10/2026',
    batch: 'COCONUT-003',
    kind: 'TransitRecorded',
    description: 'Bản ghi nhiệt độ #1: 10.0°C tại Trạm thu mua Giồng Trôm, Bến Tre',
  },
  {
    time: '10:15 27/10/2026',
    batch: 'COCONUT-001',
    kind: 'BatchSold',
    description: 'Retailer xác nhận đã bán lô; NFT vẫn thuộc Retailer',
  },
]

const KPIS = [
  {
    label: 'Tổng số lô',
    value: '4',
    hint: '1.000 kg / lô',
    tone: 'green',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: 'Ví đã cấp role',
    value: '5',
    tone: 'brown',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 5.4a3.2 3.2 0 0 1 0 5.2M17.2 14.7c1.9.5 3.1 2 3.5 4.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: 'Sự cố chưa thu hồi',
    value: '0',
    tone: 'orange',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 21V4m0 0h11.5l-2 3.5 2 3.5H5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Lô đã thu hồi',
    value: '0',
    tone: 'red',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3.5 2.8 20h18.4L12 3.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M12 9v5M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
]

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

function IncidentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

export function AdminOverviewPage() {
  const recalls = useRecalls()
  const recalledCount = Object.keys(recalls).length
  const openIncidents = INCIDENTS.filter((incident) => !recalls[incident.batchCode]).length
  const kpis = KPIS.map((kpi) => {
    if (kpi.label === 'Sự cố chưa thu hồi') return { ...kpi, value: String(openIncidents) }
    if (kpi.label === 'Lô đã thu hồi') return { ...kpi, value: String(recalledCount) }
    return kpi
  })

  return (
    <div className="overview-page">
      <PageHeader
        title="Tổng quan quản trị"
        description="Cấp role, gán farmId, điều tra sự cố và thu hồi từng lô. Admin không có quyền mặc định với hóa đơn riêng."
      />

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
              {EVENTS.map((event) => (
                <tr key={`${event.time}-${event.batch}-${event.kind}-${event.description}`}>
                  <td className="overview-event-time">{event.time}</td>
                  <td className="overview-event-batch">
                    <Link to={`/admin/batches/${event.batch}`}>{event.batch}</Link>
                  </td>
                  <td className="overview-event-kind">
                    <span className="event-kind">{event.kind}</span>
                  </td>
                  <td className="overview-event-description">{event.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
