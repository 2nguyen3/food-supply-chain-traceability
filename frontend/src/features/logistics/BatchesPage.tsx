import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../app/session'
import { DashboardIcon } from '../../components/common/DashboardIcon'
import { readLogisticsSnapshot, type LogisticsBatch } from './services/logisticsChain'

export default function LogisticsBatchesPage() {
  const navigate = useNavigate()
  const { session, restoring } = useSession()
  const [batches, setBatches] = useState<LogisticsBatch[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (restoring) return
    if (!session?.wallet.address) { setLoading(false); return }
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    readLogisticsSnapshot(session.wallet.address, ac.signal)
      .then((snap) => {
        if (!ac.signal.aborted) setBatches(snap.ownedBatches)
      })
      .catch((err) => {
        if (!ac.signal.aborted)
          setError(err instanceof Error ? err.message : 'Không đọc được danh sách lô.')
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [session?.wallet.address, restoring])

  const filtered = batches.filter((b) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      b.code.toLowerCase().includes(q) ||
      b.farmId.toLowerCase().includes(q) ||
      b.harvestGroupId.toLowerCase().includes(q)
    )
  })

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>
            Lô đang quản lý ({batches.length})
          </h1>
          <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
            Chỉ hiển thị các lô NFT hiện đang thuộc quyền sở hữu của ví Logistics trên blockchain.
          </p>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo mã lô, mã trang trại…"
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid #D6CEBE',
            fontSize: 14,
            minWidth: 260,
            background: '#FFFFFF',
          }}
        />
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          className="card"
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            borderRadius: 20,
            border: '1px solid var(--line, #E8E2D9)',
            background: '#FFFFFF',
            color: '#64748B',
          }}
        >
          Đang tải danh sách lô từ hợp đồng…
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '60px 24px',
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
              marginBottom: 14,
            }}
          >
            <DashboardIcon name="truck" />
          </div>
          <strong style={{ fontSize: 16, color: '#1E293B' }}>Không có lô nào thuộc quyền giữ của bạn</strong>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 0 0' }}>
            Hãy kiểm tra mục Yêu cầu nhận lô để tiếp nhận lô mới từ Farmer.
          </p>
        </div>
      ) : (
        <div
          className="card"
          style={{
            borderRadius: 20,
            border: '1px solid var(--line, #E8E2D9)',
            background: '#FFFFFF',
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E8E2D9', textAlign: 'left', color: '#64748B' }}>
                <th style={{ padding: '14px 18px' }}>Mã lô</th>
                <th style={{ padding: '14px 18px' }}>Trang trại / Nhóm</th>
                <th style={{ padding: '14px 18px' }}>Trạng thái</th>
                <th style={{ padding: '14px 18px' }}>Nhiệt độ</th>
                <th style={{ padding: '14px 18px' }}>Hạn sử dụng</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.tokenId} style={{ borderBottom: '1px solid #F1ECE4' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <strong style={{ color: '#1E293B' }}>{b.code}</strong>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Token #{b.tokenId} · {b.quantityKg} kg</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div>{b.farmId}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{b.harvestGroupId}</div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: b.recalled ? '#FEE2E2' : '#EBF7EE',
                        color: b.recalled ? '#DC2626' : '#16A34A',
                      }}
                    >
                      {b.recalled ? 'Recalled' : b.lifecycle}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div>{b.readings.length} bản ghi</div>
                    {b.hasTempAlert && (
                      <div style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Vượt ngưỡng 8–15°C</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', color: b.expired ? '#DC2626' : '#334155' }}>
                    {new Date(b.expiryDate).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/logistics/batches/${encodeURIComponent(b.code)}`)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#275641',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
