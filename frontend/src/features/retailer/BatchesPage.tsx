import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardIcon } from '../../components/common/DashboardIcon'

const RETAILER_BATCHES = [
  {
    code: 'COCONUT-001',
    weight: '1.000 kg · 1 NFT',
    token: '#1',
    farm: 'FARM-A',
    group: 'HG-A01',
    ownerRole: 'Retailer',
    ownerAddress: '0xBE00...0001',
    status: 'Sold · Đã bán',
    statusKey: 'Sold',
    statusType: 'sold',
    expiry: '16/12/2026',
  },
  {
    code: 'COCONUT-002',
    weight: '1.000 kg · 1 NFT',
    token: '#2',
    farm: 'FARM-A',
    group: 'HG-A01',
    ownerRole: 'Retailer',
    ownerAddress: '0xBE00...0001',
    status: 'Sold · Đã bán',
    statusKey: 'Sold',
    statusType: 'sold',
    expiry: '16/12/2026',
  },
  {
    code: 'COCONUT-003',
    weight: '1.000 kg · 1 NFT',
    token: '#3',
    farm: 'FARM-A',
    group: 'HG-A02',
    ownerRole: 'Retailer',
    ownerAddress: '0xBE00...0001',
    status: 'Delivered · Đã giao',
    statusKey: 'Delivered',
    statusType: 'delivered',
    expiry: '23/12/2026',
  },
]

export default function RetailerBatchesPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [directCode, setDirectCode] = useState('')
  const [directError, setDirectError] = useState(false)
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Lọc theo mã lô và trạng thái đã chọn
  const filteredBatches = RETAILER_BATCHES.filter((b) => {
    const matchesCode = b.code.toLowerCase().includes(searchTerm.trim().toLowerCase())
    const matchesStatus = selectedStatus === 'ALL' || b.statusKey === selectedStatus
    return matchesCode && matchesStatus
  })

  const handleOpenDirect = () => {
    const trimmed = directCode.trim()
    if (!trimmed) return

    // Kiểm tra mã lô có tồn tại chính xác trong danh sách không
    const exists = RETAILER_BATCHES.some(
      (b) => b.code.toLowerCase() === trimmed.toLowerCase()
    )

    if (exists) {
      setDirectError(false)
      navigate(`/retailer/batches/${trimmed}`)
    } else {
      setDirectError(true)
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Tiêu đề */}
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>Lô quản lý</h1>
        <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
          Các lô Retailer đang sở hữu. Sold vẫn thuộc Retailer.
        </p>
      </div>

      {/* Thanh bộ lọc & Mở mã lô */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Tìm theo mã lô..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
            style={{ width: 220, background: '#fff' }}
          />
          {/* Dropdown 6 trạng thái */}
          <select
            className="select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: 170, background: '#fff' }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="Created">Created</option>
            <option value="InTransit">InTransit</option>
            <option value="Delivered">Delivered</option>
            <option value="Sold">Sold</option>
            <option value="Recalled">Đã thu hồi</option>
          </select>
          <span className="muted" style={{ fontSize: 13, marginLeft: 4 }}>
            {filteredBatches.length} lô
          </span>
        </div>

        {/* Khung Mở lô theo mã */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Mở lô theo mã (chỉ đọc)"
              value={directCode}
              onChange={(e) => {
                setDirectCode(e.target.value)
                if (directError) setDirectError(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenDirect()}
              className="input"
              style={{
                width: 230,
                background: '#fff',
                borderColor: directError ? '#DC2626' : undefined,
                outlineColor: directError ? '#DC2626' : undefined,
              }}
            />
            <button
              type="button"
              className="button button-secondary"
              onClick={handleOpenDirect}
              style={{
                background: '#fff',
                border: '1px solid #D6CEBE',
                color: '#1E293B',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Mở
            </button>
          </div>
          {directError && (
            <span style={{ color: '#DC2626', fontSize: 12, marginLeft: 4 }}>
              Không tìm thấy mã lô.
            </span>
          )}
        </div>
      </div>

      {/* Khi không tìm thấy lô */}
      {filteredBatches.length === 0 ? (
        <div style={{ width: '100%', padding: '8px 0' }}>
          <div
            style={{
              width: '100%',
              minHeight: '420px',
              backgroundColor: '#FFF7EE',
              border: '1.5px solid #F5E5D3',
              borderRadius: '28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '60px 24px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #F3DFC8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                color: '#B45309',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1E293B', margin: '0 0 10px 0' }}>
              Không tìm thấy lô {searchTerm ? `"${searchTerm}"` : ''}
            </h2>
            <p style={{ fontSize: '15px', color: '#64748B', margin: '0 0 28px 0' }}>
              Mã lô không tồn tại.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setSelectedStatus('ALL')
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#275641',
                color: '#FFFFFF',
                padding: '12px 28px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Về tổng quan
            </button>
          </div>
        </div>
      ) : (
        /* Bảng danh sách lô */
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
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>MÃ LÔ</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>TOKEN</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>FARM / NHÓM</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>CHỦ SỞ HỮU NFT</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>TRẠNG THÁI</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>HẠN DÙNG</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((item) => {
                const isHovered = hoveredCode === item.code

                return (
                  <tr
                    key={item.code}
                    onMouseEnter={() => setHoveredCode(item.code)}
                    onMouseLeave={() => setHoveredCode(null)}
                    style={{
                      borderBottom: '1px solid var(--line, #E8E2D9)',
                      backgroundColor: isHovered ? '#F2F8F4' : '#FFFFFF',
                      transition: 'background-color 0.18s ease-in-out',
                    }}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#1E3A2F' }}>{item.code}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{item.weight}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#475569' }}>
                      {item.token}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{item.farm}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{item.group}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#F5F2EB',
                          padding: '4px 10px',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      >
                        <DashboardIcon name="store" />
                        <span style={{ fontWeight: 500 }}>{item.ownerRole}</span>
                        <span style={{ fontFamily: 'monospace', color: '#64748B' }}>{item.ownerAddress}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.ownerAddress)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex' }}
                          title="Sao chép"
                        >
                          <DashboardIcon name="copy" />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          background: item.statusType === 'sold' ? '#2A4D3B' : '#EAF5EC',
                          color: item.statusType === 'sold' ? '#FFFFFF' : '#1E7E34',
                          border: item.statusType === 'delivered' ? '1px solid #A8DAB5' : 'none',
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#475569' }}>
                      {item.expiry}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
