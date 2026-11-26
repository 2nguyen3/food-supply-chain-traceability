import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../../app/session'
import { DashboardIcon, type DashboardIconName } from '../../components/common/DashboardIcon'
import { readLogisticsSnapshot, type LogisticsSnapshot } from './services/logisticsChain'

export default function LogisticsOverviewPage() {
  const navigate = useNavigate()
  const { session, restoring } = useSession()
  const [snapshot, setSnapshot] = useState<LogisticsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (restoring) return
    if (!session?.wallet.address) { setLoading(false); return }
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    readLogisticsSnapshot(session.wallet.address, ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) setSnapshot(data)
      })
      .catch((err) => {
        if (!ac.signal.aborted)
          setError(err instanceof Error ? err.message : 'Không đọc được dữ liệu từ blockchain.')
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [session?.wallet.address, restoring])

  const incomingCount = snapshot?.incomingPending.length ?? 0
  const ownedCount = snapshot?.ownedBatches.length ?? 0
  const alertCount = snapshot?.ownedBatches.filter((b) => b.hasTempAlert).length ?? 0
  const outgoingCount = snapshot?.outgoingPending.length ?? 0

  const stats: {
    label: string
    count: number
    hint: string
    icon: DashboardIconName | 'thermometer'
    bg: string
    color: string
  }[] = [
    {
      label: 'Yêu cầu chờ nhận',
      count: incomingCount,
      hint: 'Đang chờ Logistics xác minh',
      icon: 'download',
      bg: '#FFF4E5',
      color: '#D97706',
    },
    {
      label: 'Đang giữ (InTransit)',
      count: ownedCount,
      hint: 'Lô NFT đang thuộc ví Logistics',
      icon: 'truck',
      bg: '#EBF7EE',
      color: '#16A34A',
    },
    {
      label: 'Lô có vượt ngưỡng nhiệt độ',
      count: alertCount,
      hint: 'Ngoài khoảng 8°C – 15°C',
      icon: 'thermometer',
      bg: '#FEE2E2',
      color: '#DC2626',
    },
    {
      label: 'Yêu cầu giao đang chờ',
      count: outgoingCount,
      hint: 'Đã gửi tới Retailer',
      icon: 'route',
      bg: '#F5F2EB',
      color: '#64748B',
    },
  ]

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#1E293B' }}>
            Tổng quan Logistics
          </h1>
          {session?.wallet.address && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 999,
                background: '#EEF5EE',
                color: '#275641',
                fontFamily: 'monospace',
              }}
            >
              {session.wallet.address}
            </span>
          )}
        </div>
        <p className="muted" style={{ margin: '8px 0 0 0', fontSize: 14 }}>
          Xác minh, nhận lô từ Farmer, theo dõi bản ghi nhiệt độ và bàn giao cho Retailer trên hợp đồng thông minh.
        </p>
      </div>

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
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                </svg>
              ) : (
                <DashboardIcon name={s.icon} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, color: '#475569' }}>{s.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#1E293B', marginTop: 2 }}>
                {loading ? '…' : s.count}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{s.hint}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <span>Xác minh yêu cầu nhận lô ({incomingCount})</span>
        </button>

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
          }}
        >
          <DashboardIcon name="route" />
          <span>Giao cho Retailer</span>
        </button>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Lô đang giữ ({ownedCount})
        </h2>

        {loading ? (
          <div
            className="card"
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              borderRadius: 20,
              border: '1px solid var(--line, #E8E2D9)',
              background: '#FFFFFF',
              color: '#64748B',
            }}
          >
            Đang đọc dữ liệu lô từ blockchain…
          </div>
        ) : snapshot && snapshot.ownedBatches.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {snapshot.ownedBatches.map((b) => (
              <div
                key={b.tokenId}
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 18,
                  border: '1px solid var(--line, #E8E2D9)',
                  background: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: 17, color: '#1E293B' }}>{b.code}</strong>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      Token #{b.tokenId} · {b.farmId} · {b.quantityKg.toLocaleString('vi-VN')} kg
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: '#EBF7EE',
                      color: '#16A34A',
                    }}
                  >
                    {b.lifecycle}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#475569' }}>
                  <span>Nhiệt độ đã ghi: <strong>{b.readings.length}</strong> bản</span>
                  {b.hasTempAlert && (
                    <span style={{ color: '#DC2626', fontWeight: 600 }}>• Có điểm vượt ngưỡng</span>
                  )}
                </div>

                {b.pendingOutgoing && (
                  <div
                    style={{
                      fontSize: 12,
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: '#FFF7ED',
                      color: '#C2410C',
                    }}
                  >
                    Đang chờ Retailer ({b.pendingOutgoing.toLabel}) xác nhận (Request #{b.pendingOutgoing.requestId})
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/logistics/batches/${encodeURIComponent(b.code)}`)}
                    style={{
                      flex: 1,
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#275641',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Chi tiết & Nhiệt độ
                  </button>
                  {!b.pendingOutgoing && (
                    <button
                      type="button"
                      onClick={() => navigate('/logistics/outgoing')}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 10,
                        border: '1px solid #D6CEBE',
                        background: '#FFFFFF',
                        color: '#1E293B',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Bàn giao
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </section>
    </div>
  )
}
