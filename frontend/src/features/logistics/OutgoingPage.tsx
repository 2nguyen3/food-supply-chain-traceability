import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../../app/session'
import { DashboardIcon } from '../../components/common/DashboardIcon'
import { listRoleMembers } from '../../services/roles'
import {
  cancelRetailerTransfer,
  readLogisticsSnapshot,
  requestRetailerTransfer,
  type LogisticsBatch,
  type LogisticsTransferRecord,
} from './services/logisticsChain'

export default function LogisticsOutgoingPage() {
  const { session, restoring } = useSession()
  const [ownedBatches, setOwnedBatches] = useState<LogisticsBatch[]>([])
  const [pendingList, setPendingList] = useState<LogisticsBatch[]>([])
  const [history, setHistory] = useState<LogisticsTransferRecord[]>([])
  const [retailers, setRetailers] = useState<string[]>([])
  const [selectedRetailer, setSelectedRetailer] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [txMessage, setTxMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      if (!session?.wallet.address) return
      setLoading(true)
      setError(null)
      try {
        const [snap, retailerMembers] = await Promise.all([
          readLogisticsSnapshot(session.wallet.address, signal),
          listRoleMembers('retailer', signal),
        ])
        if (signal?.aborted) return
        setOwnedBatches(snap.ownedBatches)
        setPendingList(snap.outgoingPending)
        setHistory(snap.outgoingHistory)
        setRetailers(retailerMembers)

        if (retailerMembers.length > 0) {
          setSelectedRetailer((prev) => {
            const next = { ...prev }
            for (const b of snap.ownedBatches) {
              if (!next[b.tokenId]) next[b.tokenId] = typeof retailerMembers[0] === 'string' ? retailerMembers[0] : (retailerMembers[0] as { address: string }).address
            }
            return next
          })
        }
      } catch (err) {
        if (!signal?.aborted)
          setError(err instanceof Error ? err.message : 'Không đọc được dữ liệu bàn giao.')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [session?.wallet.address],
  )

  useEffect(() => {
    if (restoring) return
    if (!session?.wallet.address) {
      setLoading(false)
      return
    }
    const ac = new AbortController()
    void loadAll(ac.signal)
    return () => ac.abort()
  }, [session?.wallet.address, restoring, loadAll])

  const handleRequestTransfer = async (batch: LogisticsBatch) => {
    if (!session?.wallet.address) return
    const target = selectedRetailer[batch.tokenId]
    if (!target) {
      setTxMessage({ kind: 'err', text: 'Vui lòng chọn ví Retailer nhận hàng.' })
      return
    }
    setTxMessage(null)
    setBusyId(batch.tokenId)
    try {
      await requestRetailerTransfer(session.wallet.address, batch.tokenId, target, {
        onSigning: () =>
          setTxMessage({ kind: 'ok', text: `Đang chờ ký gửi yêu cầu giao lô ${batch.code} trong MetaMask…` }),
        onBroadcast: (hash) =>
          setTxMessage({ kind: 'ok', text: `Đã gửi giao dịch (${hash.slice(0, 10)}…), đang chờ xác nhận…` }),
      })
      setTxMessage({
        kind: 'ok',
        text: `Đã gửi yêu cầu bàn giao lô ${batch.code} cho Retailer.`,
      })
      await loadAll()
    } catch (err) {
      setTxMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Gửi yêu cầu bàn giao thất bại.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleCancelTransfer = async (batch: LogisticsBatch) => {
    if (!session?.wallet.address || !batch.pendingOutgoing) return
    setTxMessage(null)
    setBusyId(batch.tokenId)
    try {
      await cancelRetailerTransfer(
        session.wallet.address,
        batch.tokenId,
        batch.pendingOutgoing.requestId,
        {
          onSigning: () =>
            setTxMessage({ kind: 'ok', text: `Đang chờ ký hủy yêu cầu lô ${batch.code}…` }),
          onBroadcast: (hash) =>
            setTxMessage({ kind: 'ok', text: `Đã gửi giao dịch hủy (${hash.slice(0, 10)}…)…` }),
        },
      )
      setTxMessage({ kind: 'ok', text: `Đã hủy yêu cầu bàn giao lô ${batch.code}.` })
      await loadAll()
    } catch (err) {
      setTxMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Hủy yêu cầu thất bại.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const transferableBatches = ownedBatches.filter(
    (b) => b.lifecycle === 'InTransit' && !b.recalled && !b.expired && !b.pendingOutgoing,
  )

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>Giao cho Retailer</h1>
        <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
          Gửi yêu cầu chuyển (requestTransfer) tới Retailer. Mỗi lô tối đa một yêu cầu đang hoạt động.
        </p>
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

      {txMessage && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: txMessage.kind === 'ok' ? '#EBF7EE' : '#FEF2F2',
            border: `1px solid ${txMessage.kind === 'ok' ? '#BBF7D0' : '#FECACA'}`,
            color: txMessage.kind === 'ok' ? '#15803D' : '#B91C1C',
            fontSize: 14,
          }}
        >
          {txMessage.text}
        </div>
      )}

      {/* 1. Lô có thể chuyển */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Lô có thể chuyển ({transferableBatches.length})
        </h2>

        {loading ? (
          <div className="card" style={{ padding: 36, textAlign: 'center', borderRadius: 20, background: '#FFFFFF' }}>
            Đang tải danh sách lô…
          </div>
        ) : transferableBatches.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '46px 24px',
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
            <strong style={{ fontSize: 16, color: '#1E293B' }}>Không có lô sẵn sàng bàn giao</strong>
            <p className="muted" style={{ fontSize: 13, margin: '6px 0 0 0' }}>
              Lô phải thuộc quyền giữ của bạn, trạng thái InTransit và chưa có yêu cầu đang chờ.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {transferableBatches.map((b) => {
              const isBusy = busyId === b.tokenId
              return (
                <div
                  key={b.tokenId}
                  className="card"
                  style={{
                    padding: 20,
                    borderRadius: 18,
                    border: '1px solid var(--line, #E8E2D9)',
                    background: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 14,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 17, color: '#1E293B' }}>{b.code}</strong>
                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                      Token #{b.tokenId} · {b.farmId} · {b.readings.length} bản ghi nhiệt độ
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={selectedRetailer[b.tokenId] ?? ''}
                      onChange={(e) =>
                        setSelectedRetailer((prev) => ({ ...prev, [b.tokenId]: e.target.value }))
                      }
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1px solid #D6CEBE',
                        fontSize: 13,
                        background: '#FFFFFF',
                        minWidth: 240,
                      }}
                    >
                      {retailers.length === 0 ? (
                        <option value="">Chưa có ví Retailer trên chain</option>
                      ) : (
                        retailers.map((r) => {
                          const addr = typeof r === 'string' ? r : (r as { address: string }).address
                          return (
                            <option key={addr} value={addr}>
                              Retailer · {addr.slice(0, 6)}…{addr.slice(-4)}
                            </option>
                          )
                        })
                      )}
                    </select>

                    <button
                      type="button"
                      disabled={isBusy || retailers.length === 0}
                      onClick={() => handleRequestTransfer(b)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 12,
                        border: 'none',
                        background: isBusy || retailers.length === 0 ? '#CBD5E1' : '#275641',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: isBusy || retailers.length === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isBusy ? 'Đang gửi…' : 'Gửi yêu cầu bàn giao'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 2. Yêu cầu đang chờ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Yêu cầu đang chờ ({pendingList.length})
        </h2>
        {pendingList.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '44px 24px',
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
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#EEF5EE',
                color: '#275641',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <DashboardIcon name="route" />
            </div>
            <strong style={{ fontSize: 16, color: '#1E293B' }}>Không có yêu cầu đang chờ</strong>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingList.map((b) => {
              const isBusy = busyId === b.tokenId
              return (
                <div
                  key={b.tokenId}
                  className="card"
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    border: '1px solid #FED7AA',
                    background: '#FFFBEB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 16, color: '#1E293B' }}>
                      {b.code} (Request #{b.pendingOutgoing?.requestId})
                    </strong>
                    <div style={{ fontSize: 13, color: '#92400E', marginTop: 2 }}>
                      Người nhận: <strong>{b.pendingOutgoing?.toLabel}</strong> · Gửi lúc{' '}
                      {b.pendingOutgoing?.requestedAt
                        ? new Date(b.pendingOutgoing.requestedAt).toLocaleString('vi-VN')
                        : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleCancelTransfer(b)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 10,
                      border: '1px solid #FECACA',
                      background: '#FFFFFF',
                      color: '#DC2626',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isBusy ? 'Đang hủy…' : 'Hủy yêu cầu'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 3. Lịch sử yêu cầu */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Lịch sử yêu cầu ({history.length})
        </h2>
        {history.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '44px 24px',
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
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#EEF5EE',
                color: '#275641',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <DashboardIcon name="clock" />
            </div>
            <strong style={{ fontSize: 16, color: '#1E293B' }}>Chưa có lịch sử</strong>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E2D9', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '12px 16px' }}>Request</th>
                  <th style={{ padding: '12px 16px' }}>Mã lô</th>
                  <th style={{ padding: '12px 16px' }}>Retailer</th>
                  <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                  <th style={{ padding: '12px 16px' }}>Thời gian đóng</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={`${h.tokenId}-${h.requestId}`} style={{ borderBottom: '1px solid #F1ECE4' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{h.requestId}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{h.batchCode}</td>
                    <td style={{ padding: '12px 16px' }}>{h.toLabel}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background:
                            h.status === 'accepted'
                              ? '#EBF7EE'
                              : h.status === 'rejected'
                                ? '#FEE2E2'
                                : '#F1F5F9',
                          color:
                            h.status === 'accepted'
                              ? '#16A34A'
                              : h.status === 'rejected'
                                ? '#DC2626'
                                : '#475569',
                        }}
                      >
                        {h.status === 'accepted'
                          ? 'Retailer đã nhận'
                          : h.status === 'rejected'
                            ? 'Retailer từ chối'
                            : 'Đã hủy'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{new Date(h.closedAt).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div
        style={{
          background: '#FAF7F2',
          border: '1px solid var(--line, #E8E2D9)',
          borderRadius: 14,
          padding: '16px 20px',
          fontSize: 13,
          color: '#78716C',
        }}
      >
        🔒 Chuyển trực tiếp ERC-721 (transferFrom) không được hỗ trợ. Chỉ dùng requestTransfer → acceptTransfer.
      </div>
    </div>
  )
}
