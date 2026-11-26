import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../../app/session'
import { DashboardIcon } from '../../components/common/DashboardIcon'
import {
  acceptBatchTransfer,
  readLogisticsSnapshot,
  rejectBatchTransfer,
  verifyBatchIpfsFiles,
  type FileHashCheckResult,
  type LogisticsBatch,
  type LogisticsTransferRecord,
} from './services/logisticsChain'

interface VerificationState {
  checking: boolean
  allMatched: boolean
  files: FileHashCheckResult[]
}

export default function LogisticsIncomingPage() {
  const { session, restoring } = useSession()
  const [incoming, setIncoming] = useState<LogisticsBatch[]>([])
  const [history, setHistory] = useState<LogisticsTransferRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [verifyMap, setVerifyMap] = useState<Record<string, VerificationState>>({})
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null)
  const [txMessage, setTxMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      if (!session?.wallet.address) return
      setLoading(true)
      setError(null)
      try {
        const snap = await readLogisticsSnapshot(session.wallet.address, signal)
        if (signal?.aborted) return
        setIncoming(snap.incomingPending)
        setHistory(snap.incomingHistory)
      } catch (err) {
        if (!signal?.aborted)
          setError(err instanceof Error ? err.message : 'Không đọc được danh sách yêu cầu nhận lô.')
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
    void loadData(ac.signal)
    return () => ac.abort()
  }, [session?.wallet.address, restoring, loadData])

  const handleVerify = async (batch: LogisticsBatch) => {
    setVerifyMap((prev) => ({
      ...prev,
      [batch.tokenId]: { checking: true, allMatched: false, files: [] },
    }))
    const res = await verifyBatchIpfsFiles(batch)
    setVerifyMap((prev) => ({
      ...prev,
      [batch.tokenId]: { checking: false, allMatched: res.allMatched, files: res.files },
    }))
  }

  const handleAccept = async (batch: LogisticsBatch) => {
    if (!session?.wallet.address) return
    setTxMessage(null)
    setBusyTokenId(batch.tokenId)
    try {
      await acceptBatchTransfer(session.wallet.address, batch, {
        onSigning: () =>
          setTxMessage({ kind: 'ok', text: `Đang chờ ký xác nhận nhận lô ${batch.code} trong MetaMask…` }),
        onBroadcast: (hash) =>
          setTxMessage({ kind: 'ok', text: `Đã gửi giao dịch (${hash.slice(0, 10)}…), đang chờ xác nhận…` }),
      })
      setTxMessage({
        kind: 'ok',
        text: `Đã nhận lô ${batch.code} thành công! Quyền sở hữu NFT đã chuyển sang ví Logistics.`,
      })
      await loadData()
    } catch (err) {
      setTxMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Không chấp nhận được yêu cầu bàn giao.',
      })
    } finally {
      setBusyTokenId(null)
    }
  }

  const handleReject = async (batch: LogisticsBatch) => {
    if (!session?.wallet.address) return
    setTxMessage(null)
    setBusyTokenId(batch.tokenId)
    try {
      await rejectBatchTransfer(session.wallet.address, batch, {
        onSigning: () =>
          setTxMessage({ kind: 'ok', text: `Đang chờ ký từ chối lô ${batch.code} trong MetaMask…` }),
        onBroadcast: (hash) =>
          setTxMessage({ kind: 'ok', text: `Đã gửi giao dịch từ chối (${hash.slice(0, 10)}…)…` }),
      })
      setTxMessage({ kind: 'ok', text: `Đã từ chối yêu cầu nhận lô ${batch.code}.` })
      await loadData()
    } catch (err) {
      setTxMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Không từ chối được yêu cầu bàn giao.',
      })
    } finally {
      setBusyTokenId(null)
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Yêu cầu nhận lô ({incoming.length})
        </h1>
        <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
          Xác minh lần lượt 3 hash SHA-256 (metadata.json, certificate.pdf, batch.jpg) từ IPFS rồi mới chấp nhận. Từ chối luôn khả dụng.
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
          Đang tải yêu cầu chờ nhận từ hợp đồng…
        </div>
      ) : incoming.length === 0 ? (
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
              marginBottom: 16,
            }}
          >
            <DashboardIcon name="download" />
          </div>
          <strong style={{ fontSize: 16, color: '#1E293B' }}>Không có yêu cầu đang chờ</strong>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 0 0' }}>
            Khi Farmer gửi yêu cầu chuyển giao lô, yêu cầu sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {incoming.map((b) => {
            const v = verifyMap[b.tokenId]
            const isBusy = busyTokenId === b.tokenId
            return (
              <div
                key={b.tokenId}
                className="card"
                style={{
                  padding: 22,
                  borderRadius: 20,
                  border: '1px solid var(--line, #E8E2D9)',
                  background: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 18, color: '#1E293B' }}>{b.code}</strong>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: '#FFF4E5',
                          color: '#D97706',
                        }}
                      >
                        Request #{b.pendingIncoming?.requestId}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                      Bên gửi: <strong>{b.pendingIncoming?.fromLabel}</strong> · Nông trại: {b.farmId} ({b.harvestGroupId}) · {b.quantityKg} kg
                    </div>
                    {b.pendingIncoming?.requestedAt && (
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        Thời gian gửi (giờ block): {new Date(b.pendingIncoming.requestedAt).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={v?.checking || isBusy}
                      onClick={() => handleVerify(b)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 12,
                        border: '1px solid #275641',
                        background: '#FFFFFF',
                        color: '#275641',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: v?.checking || isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {v?.checking ? 'Đang kiểm tra 3 hash…' : '1. Xác minh 3 hash IPFS'}
                    </button>

                    <button
                      type="button"
                      disabled={!v?.allMatched || isBusy}
                      onClick={() => handleAccept(b)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 12,
                        border: 'none',
                        background: !v?.allMatched || isBusy ? '#CBD5E1' : '#275641',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: !v?.allMatched || isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isBusy ? 'Đang xử lý…' : '2. Chấp nhận nhận lô'}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleReject(b)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 12,
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>

                {/* Kết quả đối chiếu từng tệp IPFS */}
                {v && v.files.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 12,
                      paddingTop: 12,
                      borderTop: '1px solid #F1ECE4',
                    }}
                  >
                    {v.files.map((f) => (
                      <div
                        key={f.key}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: f.matched ? '#F0FDF4' : '#FEF2F2',
                          border: `1px solid ${f.matched ? '#BBF7D0' : '#FECACA'}`,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                          <span>{f.label}</span>
                          <span style={{ color: f.matched ? '#15803D' : '#DC2626' }}>
                            {f.matched ? 'KHỚP' : 'LỖI HASH'}
                          </span>
                        </div>
                        <div style={{ color: '#64748B', marginTop: 4, fontFamily: 'monospace', fontSize: 11 }}>
                          Chain: {f.expectedHash.slice(0, 14)}…{f.expectedHash.slice(-8)}
                        </div>
                        {f.actualHash && (
                          <div style={{ color: '#334155', marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}>
                            IPFS : {f.actualHash.slice(0, 14)}…{f.actualHash.slice(-8)}
                          </div>
                        )}
                        {f.error && <div style={{ color: '#DC2626', marginTop: 4 }}>{f.error}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Lịch sử xử lý */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Lịch sử xử lý ({history.length})
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
                  <th style={{ padding: '12px 16px' }}>Bên gửi</th>
                  <th style={{ padding: '12px 16px' }}>Kết quả</th>
                  <th style={{ padding: '12px 16px' }}>Thời gian xử lý</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={`${h.tokenId}-${h.requestId}`} style={{ borderBottom: '1px solid #F1ECE4' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{h.requestId}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{h.batchCode}</td>
                    <td style={{ padding: '12px 16px' }}>{h.fromLabel}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: h.status === 'accepted' ? '#EBF7EE' : '#FEE2E2',
                          color: h.status === 'accepted' ? '#16A34A' : '#DC2626',
                        }}
                      >
                        {h.status === 'accepted' ? 'Đã nhận' : 'Đã từ chối'}
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
    </div>
  )
}
