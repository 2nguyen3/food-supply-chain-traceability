import { useNavigate, Link } from 'react-router-dom'
import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function LogisticsOverviewPage() {
  const navigate = useNavigate()

  const stats = [
    {
      label: 'Yêu cầu chờ nhận',
      count: 0,
      icon: 'download' as const,
      bg: '#FFF4E5',
      color: '#D97706',
    },
    {
      label: 'Lô đang vận chuyển',
      count: 0,
      icon: 'truck' as const,
      bg: '#EBF7EE',
      color: '#16A34A',
    },
    {
      label: 'Lô có vượt ngưỡng nhiệt độ',
      count: 0,
      icon: 'thermometer',
      bg: '#FEE2E2',
      color: '#DC2626',
    },
    {
      label: 'Yêu cầu giao đang chờ',
      count: 0,
      icon: 'route' as const,
      bg: '#F5F2EB',
      color: '#64748B',
    },
  ]

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Tiêu đề */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Tổng quan Logistics
        </h1>
        <p className="muted" style={{ margin: '8px 0 0 0', fontSize: 14 }}>
          Xác minh, nhận lô từ Farmer, theo dõi bản ghi nhiệt độ (do script Python/Web3.py đọc từ CSV) và giao cho Retailer.
        </p>
      </div>

      {/* 4 thẻ thống kê 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {stats.map((s, idx) => (
          <div
            key={idx}
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '24px 28px',
              borderRadius: 20,
              background: '#FFFFFF',
              border: '1px solid var(--line, #E8E2D9)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: s.bg,
                color: s.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {s.icon === 'thermometer' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                </svg>
              ) : (
                <DashboardIcon name={s.icon as any} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#475569' }}>{s.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#1E293B', marginTop: 2 }}>{s.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 2 nút thao tác */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => navigate('/logistics/incoming')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#275641',
            color: '#FFFFFF',
            border: 'none',
            padding: '12px 22px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <DashboardIcon name="download" />
          <span>Xác minh yêu cầu nhận lô</span>
        </button>

        {/* Nút Giao cho Retailer nhảy trực tiếp sang /logistics/outgoing */}
        <button
          type="button"
          onClick={() => navigate('/logistics/outgoing')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FFFFFF',
            color: '#1E293B',
            border: '1.5px solid #D6CEBE',
            padding: '11px 22px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F5F2EB')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
        >
          <DashboardIcon name="route" />
          <span>Giao cho Retailer</span>
        </button>
      </div>

      {/* Lô đang giữ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>Lô đang giữ</h2>
        <div
          className="card"
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 20,
            border: '1px solid var(--line, #E8E2D9)',
            background: '#FFFFFF',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#EEF5EE',
              color: '#275641',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              aspectRatio: '1 / 1',
              marginBottom: 14,
            }}
          >
            <DashboardIcon name="truck" />
          </div>
          <strong style={{ fontSize: 16, color: '#1E293B' }}>Chưa giữ lô nào</strong>
        </div>
      </section>
    </div>
  )
}