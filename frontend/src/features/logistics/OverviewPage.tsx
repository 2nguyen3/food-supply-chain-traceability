import { Link } from 'react-router-dom'
import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function LogisticsOverviewPage() {
  const stats = [
    { label: 'Yêu cầu chờ nhận', count: 0, icon: 'download' as const, bg: 'var(--amber-light, #FFF4E5)', color: '#D97706' },
    { label: 'Lô đang vận chuyển', count: 0, icon: 'truck' as const, bg: 'var(--emerald-light, #EBF7EE)', color: '#16A34A' },
    { label: 'Lô có vượt ngưỡng nhiệt độ', count: 0, icon: 'flag' as const, bg: '#FEE2E2', color: '#DC2626' },
    { label: 'Yêu cầu giao đang chờ', count: 0, icon: 'route' as const, bg: '#F3F4F6', color: '#4B5563' },
  ]

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Tổng quan Logistics</h1>
        <p className="muted" style={{ margin: '4px 0 0 0' }}>
          Xác minh, nhận lô từ Farmer, theo dõi bản ghi nhiệt độ (do script Python/Web3.py đọc từ CSV) và giao cho Retailer.
        </p>
      </header>

      {/* 4 Thẻ thống kê */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {stats.map((s, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20 }}>
            <div style={{ padding: 12, borderRadius: 12, background: s.bg, color: s.color, display: 'flex' }}>
              <DashboardIcon name={s.icon} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted, #64748B)' }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{s.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Nút tác vụ nhanh */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/logistics/incoming" className="button button-primary" style={{ textDecoration: 'none' }}>
          <DashboardIcon name="download" />
          <span>Xác minh yêu cầu nhận lô</span>
        </Link>
        <Link to="/logistics/outgoing" className="button button-secondary" style={{ textDecoration: 'none' }}>
          <DashboardIcon name="route" />
          <span>Giao cho Retailer</span>
        </Link>
      </div>

      {/* Lô đang giữ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Lô đang giữ</h2>
        <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#EEF5EE', color: '#2D5A43', marginBottom: 12 }}>
            <DashboardIcon name="truck" />
          </div>
          <strong style={{ fontSize: 15 }}>Chưa giữ lô nào</strong>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 0 0' }}>
            Khi bạn chấp nhận yêu cầu từ Farmer, lô sẽ xuất hiện ở đây với trạng thái InTransit.
          </p>
        </div>
      </section>
    </div>
  )
}