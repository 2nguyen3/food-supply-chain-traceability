import { useState } from 'react'

export default function RetailerSalesPage() {
  const [salesBatches, setSalesBatches] = useState([
    {
      code: 'COCONUT-001',
      status: 'Sold · Đã bán',
      isSold: true,
      owner: 'Retailer (không đổi)',
    },
    {
      code: 'COCONUT-002',
      status: 'Sold · Đã bán',
      isSold: true,
      owner: 'Retailer (không đổi)',
    },
    {
      code: 'COCONUT-003',
      status: 'Delivered · Đã giao',
      isSold: false,
      owner: 'Retailer (không đổi)',
    },
  ])

  // Trạng thái hover theo mã lô
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)

  const handleMarkAsSold = (code: string) => {
    setSalesBatches((prev) =>
      prev.map((item) =>
        item.code === code ? { ...item, status: 'Sold · Đã bán', isSold: true } : item
      )
    )
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>Đánh dấu đã bán</h1>
        <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
          Chỉ lô Delivered thuộc Retailer, chưa hết hạn và chưa bị thu hồi mới đánh dấu được. Đây không phải đơn hàng hay thanh toán.
        </p>
      </header>

      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          border: '1px solid var(--line, #E8E2D9)',
          borderRadius: 16,
          background: '#fff',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#FAF7F2', borderBottom: '1px solid var(--line, #E8E2D9)', color: '#64748B' }}>
              <th style={{ padding: '16px 24px', fontWeight: 600 }}>LÔ</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>TRẠNG THÁI</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>CHỦ NFT</th>
              <th style={{ padding: '16px 24px', fontWeight: 600 }}>HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody>
            {salesBatches.map((item) => {
              const isHovered = hoveredCode === item.code

              return (
                <tr
                  key={item.code}
                  onMouseEnter={() => setHoveredCode(item.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                  style={{
                    borderBottom: '1px solid var(--line, #E8E2D9)',
                    // Khi di chuột vào sẽ sáng nền xanh lá nhạt
                    backgroundColor: isHovered ? '#F2F8F4' : '#FFFFFF',
                    transition: 'background-color 0.18s ease-in-out',
                  }}
                >
                  <td style={{ padding: '18px 24px', fontWeight: 700, color: '#1E293B' }}>
                    {item.code}
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: item.isSold ? '#2A4D3B' : '#EAF5EC',
                        color: item.isSold ? '#FFFFFF' : '#1E7E34',
                        border: !item.isSold ? '1px solid #A8DAB5' : 'none',
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '18px 20px', color: '#475569' }}>
                    {item.owner}
                  </td>
                  <td style={{ padding: '18px 24px' }}>
                    {item.isSold ? (
                      <div>
                        <button
                          type="button"
                          disabled
                          style={{
                            background: '#CCD6D0',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '8px 18px',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'not-allowed',
                          }}
                        >
                          Đánh dấu đã bán
                        </button>
                        <div style={{ color: '#DC2626', fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>ⓘ</span> Lô {item.code} đã bán (Sold), không thể đánh dấu đã bán.
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkAsSold(item.code)}
                        style={{
                          background: '#275641',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '8px 18px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1E4333')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#275641')}
                      >
                        Đánh dấu đã bán
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}