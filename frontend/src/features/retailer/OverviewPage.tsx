import { Link } from 'react-router-dom'
import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function RetailerOverviewPage() {
  const stats = [
    { label: 'Chờ xác minh/nhận', count: 0, icon: 'download' as const, bg: '#FFF4E5', color: '#D97706' },
    { label: 'Đã giao (Delivered)', count: 1, icon: 'box' as const, bg: '#EBF7EE', color: '#16A34A' },
    { label: 'Đã bán (Sold)', count: 2, icon: 'store' as const, bg: '#F5F2EB', color: '#64748B' },
    { label: 'Sự cố đã báo', count: 0, icon: 'flag' as const, bg: '#FEE2E2', color: '#DC2626' },
  ]

  const myBatches = [
    {
      code: 'COCONUT-001',
      token: '#1',
      group: 'FARM-A · HG-A01',
      status: 'Sold · Đã bán',
      statusType: 'sold',
      img: '/images/home/coconut-cluster.jpg',
    },
    {
      code: 'COCONUT-002',
      token: '#2',
      group: 'FARM-A · HG-A01',
      status: 'Sold · Đã bán',
      statusType: 'sold',
      img: '/images/home/coconut-farm.jpg',
    },
    {
      code: 'COCONUT-003',
      token: '#3',
      group: 'FARM-A · HG-A02',
      status: 'Delivered · Đã giao',
      statusType: 'delivered',
      img: '/images/home/coconut-grove-hero.jpg',
    },
  ]

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#1E293B' }}>Tổng quan Retailer</h1>
        <p className="muted" style={{ margin: '8px 0 16px 0', fontSize: 14 }}>
          Xác minh và nhận lô từ Logistics, đánh dấu đã bán và báo cáo sự cố (kể cả sau khi lô đã bán).
        </p>
        <Link
          to="/retailer/incidents/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#275641',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <DashboardIcon name="flag" />
          <span>Báo cáo sự cố</span>
        </Link>
      </div>

      {/* 4 Cards thống kê chia lưới 2x2 */}
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
              background: '#fff',
              border: '1px solid var(--line, #E8E2D9)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: s.bg,
                color: s.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DashboardIcon name={s.icon} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748B' }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B', marginTop: 2 }}>{s.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lô của tôi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#1E293B' }}>Lô của tôi</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {myBatches.map((b) => (
            <div
              key={b.code}
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                borderRadius: 20,
                border: '1px solid var(--line, #E8E2D9)',
                background: '#fff',
              }}
            >
              <div style={{ width: '100%', height: 170, overflow: 'hidden', background: '#F1ECE6' }}>
                <img
                  src={b.img}
                  alt={b.code}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>{b.code}</span>
                  <span style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'monospace' }}>{b.token}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{b.group}</div>
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: b.statusType === 'sold' ? '#2A4D3B' : '#EAF5EC',
                      color: b.statusType === 'sold' ? '#FFFFFF' : '#1E7E34',
                      border: b.statusType === 'delivered' ? '1px solid #A8DAB5' : 'none',
                    }}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}