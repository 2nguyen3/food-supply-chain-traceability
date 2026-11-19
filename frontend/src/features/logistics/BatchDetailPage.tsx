import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSession } from '../../app/session'
import { config } from '../../config/env'
import {
  readLogisticsSnapshot,
  recordBatchTransit,
  TEMP_MAX_C,
  TEMP_MIN_C,
  verifyBatchIpfsFiles,
  type FileHashCheckResult,
  type LogisticsBatch,
} from './services/logisticsChain'

function toLocalDatetimeInput(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function LogisticsBatchDetailPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session, restoring } = useSession()

  const [batch, setBatch] = useState<LogisticsBatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'temp' | 'docs'>('temp')

  // Kiểm tra 3 hash IPFS
  const [verifying, setVerifying] = useState(false)
  const [verifyResults, setVerifyResults] = useState<FileHashCheckResult[] | null>(null)

  // Form ghi nhiệt độ recordTransit
  const [tempInput, setTempInput] = useState('12.5')
  const [locationInput, setLocationInput] = useState('Kho lạnh trung chuyển Cần Thơ')
  const [observedInput, setObservedInput] = useState(() => toLocalDatetimeInput())
  const [txStatus, setTxStatus] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadBatch = useCallback(
    async (signal?: AbortSignal) => {
      if (!session?.wallet.address || !code) return
      setLoading(true)
      setError(null)
      try {
        const snap = await readLogisticsSnapshot(session.wallet.address, signal)
        if (signal?.aborted) return
        const found = snap.allRelevantBatches.get(decodeURIComponent(code)) ?? null
        setBatch(found)
        setObservedInput(toLocalDatetimeInput())
      } catch (err) {
        if (!signal?.aborted)
          setError(err instanceof Error ? err.message : 'Không đọc được thông tin lô.')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [session?.wallet.address, code],
  )

  useEffect(() => {
    if (restoring) return
    if (!session?.wallet.address) {
      setLoading(false)
      return
    }
    const ac = new AbortController()
    void loadBatch(ac.signal)
    return () => ac.abort()
  }, [session?.wallet.address, restoring, loadBatch])

  const handleVerifyHashes = async () => {
    if (!batch) return
    setVerifying(true)
    try {
      const res = await verifyBatchIpfsFiles(batch)
      setVerifyResults(res.files)
    } finally {
      setVerifying(false)
    }
  }

  const handleRecordTransit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batch || !session?.wallet.address) return
    setTxError(null)
    setTxStatus(null)

    const tempVal = Number(tempInput)
    if (!Number.isFinite(tempVal) || tempVal < -50 || tempVal > 100) {
      setTxError('Nhiệt độ không hợp lệ (cần nằm trong khoảng -50°C đến 100°C).')
      return
    }
    if (!locationInput.trim()) {
      setTxError('Vui lòng nhập vị trí ghi nhận nhiệt độ.')
      return
    }
    const observedMs = Date.parse(observedInput)
    if (!Number.isFinite(observedMs)) {
      setTxError('Thời điểm đo không hợp lệ.')
      return
    }
    const observedAtSec = Math.floor(observedMs / 1000)
    const nextReadingId =
      batch.readings.reduce((max, r) => Math.max(max, Number(r.readingId)), 0) + 1

    setSubmitting(true)
    try {
      await recordBatchTransit(
        session.wallet.address,
        {
          tokenId: batch.tokenId,
          readingId: nextReadingId,
          tempC: tempVal,
          observedAtSec,
          location: locationInput,
        },
        {
          onSigning: () => setTxStatus('Đang chờ bạn ký giao dịch trong MetaMask…'),
          onBroadcast: (hash) => setTxStatus(`Đã gửi giao dịch (${hash.slice(0, 10)}…), đang chờ xác nhận…`),
        },
      )
      setTxStatus(`Đã ghi bản nhiệt độ #${nextReadingId} (${tempVal}°C) lên blockchain.`)
      await loadBatch()
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Ghi nhiệt độ thất bại.')
      setTxStatus(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-container">
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
          Đang tải thông tin lô từ blockchain…
        </div>
      </div>
    )
  }

  if (error || !batch) {
    const displayCode = code ? `"${decodeURIComponent(code)}"` : '":code"'
    return (
      <div style={{ width: '100%', padding: '16px 0' }}>
        <div
          style={{
            width: '100%',
            minHeight: '380px',
            backgroundColor: '#FFF7EE',
            border: '1.5px solid #F5E5D3',
            borderRadius: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '48px 24px',
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1E293B', margin: '0 0 10px 0' }}>
            {error ? 'Lỗi tải dữ liệu lô' : `Không tìm thấy lô ${displayCode}`}
          </h2>
          <p style={{ fontSize: 15, color: '#64748B', margin: '0 0 24px 0' }}>
            {error ?? 'Lô không tồn tại hoặc không thuộc quyền quản lý của ví Logistics này.'}
          </p>
          <Link
            to="/logistics/batches"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#275641',
              color: '#FFFFFF',
              padding: '12px 24px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Quay lại danh sách lô
          </Link>
        </div>
      </div>
    )
  }

  const publicTracePath =
    config.contractAddress
      ? `/trace/${config.chainId}/${config.contractAddress}/${batch.tokenId}`
      : `/trace?code=${encodeURIComponent(batch.code)}`

  const canRecordTransit =
    batch.ownedByMe &&
    batch.lifecycle === 'InTransit' &&
    !batch.recalled &&
    !batch.expired &&
    !batch.pendingOutgoing

  const parsedTemp = Number(tempInput)
  const previewOutOfRange =
    Number.isFinite(parsedTemp) && (parsedTemp < TEMP_MIN_C || parsedTemp > TEMP_MAX_C)

  // Tính toạ độ biểu đồ SVG cho nhiệt độ
  const chartW = 640
  const chartH = 210
  const padL = 42
  const padR = 20
  const padT = 20
  const padB = 34
  const minY = 0
  const maxY = 26
  const yOf = (t: number) =>
    padT + ((maxY - Math.max(minY, Math.min(maxY, t))) / (maxY - minY)) * (chartH - padT - padB)
  const xOf = (idx: number, total: number) =>
    total <= 1
      ? (padL + chartW - padR) / 2
      : padL + (idx / (total - 1)) * (chartW - padL - padR)

  const points = batch.readings.map((r, i) => ({
    ...r,
    x: xOf(i, batch.readings.length),
    y: yOf(r.tempC),
  }))
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Thanh điều hướng trên */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link
            to="/logistics/batches"
            style={{ fontSize: 13, color: '#275641', textDecoration: 'none', fontWeight: 600 }}
          >
            ← Danh sách lô đang quản lý
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#1E293B' }}>{batch.code}</h1>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 999,
                background: batch.recalled ? '#FEE2E2' : '#EBF7EE',
                color: batch.recalled ? '#DC2626' : '#16A34A',
              }}
            >
              {batch.recalled ? 'Recalled' : batch.lifecycle}
            </span>
            <span style={{ fontSize: 13, color: '#64748B' }}>Token #{batch.tokenId}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={publicTracePath}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #D6CEBE',
              background: '#FFFFFF',
              color: '#1E293B',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Mở trang công khai ↗
          </a>
          {canRecordTransit && (
            <button
              type="button"
              onClick={() => navigate('/logistics/outgoing')}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: 'none',
                background: '#275641',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Bàn giao cho Retailer
            </button>
          )}
        </div>
      </div>

      {/* Thẻ thông tin chung của lô */}
      <div
        className="card"
        style={{
          padding: 22,
          borderRadius: 20,
          border: '1px solid var(--line, #E8E2D9)',
          background: '#FFFFFF',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16,
          fontSize: 14,
        }}
      >
        <div>
          <div style={{ color: '#64748B', fontSize: 12 }}>Chủ sở hữu NFT hiện tại</div>
          <div style={{ fontWeight: 600, color: '#1E293B', marginTop: 4, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
            {batch.owner}
          </div>
          <div style={{ fontSize: 12, color: '#16A34A', marginTop: 2 }}>{batch.ownerLabel}</div>
        </div>
        <div>
          <div style={{ color: '#64748B', fontSize: 12 }}>Nông trại & Nhóm thu hoạch</div>
          <div style={{ fontWeight: 600, color: '#1E293B', marginTop: 4 }}>
            {batch.farmId} · {batch.harvestGroupId}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{batch.farmLocation}</div>
        </div>
        <div>
          <div style={{ color: '#64748B', fontSize: 12 }}>Khối lượng & Ngày thu hoạch</div>
          <div style={{ fontWeight: 600, color: '#1E293B', marginTop: 4 }}>
            {batch.quantityKg.toLocaleString('vi-VN')} kg
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            {new Date(batch.harvestDate).toLocaleDateString('vi-VN')}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B', fontSize: 12 }}>Hạn sử dụng</div>
          <div style={{ fontWeight: 600, color: batch.expired ? '#DC2626' : '#1E293B', marginTop: 4 }}>
            {new Date(batch.expiryDate).toLocaleDateString('vi-VN')}
          </div>
          <div style={{ fontSize: 12, color: batch.expired ? '#DC2626' : '#64748B', marginTop: 2 }}>
            {batch.expired ? 'Đã hết hạn' : 'Còn hạn sử dụng'}
          </div>
        </div>
      </div>

      {/* Tabs: Nhiệt độ vận chuyển | Hồ sơ công khai (3 hash) */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setTab('temp')}
          style={{
            padding: '10px 18px',
            borderRadius: 12,
            border: tab === 'temp' ? 'none' : '1px solid #D6CEBE',
            background: tab === 'temp' ? '#275641' : '#FFFFFF',
            color: tab === 'temp' ? '#FFFFFF' : '#1E293B',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Nhiệt độ vận chuyển ({batch.readings.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('docs')}
          style={{
            padding: '10px 18px',
            borderRadius: 12,
            border: tab === 'docs' ? 'none' : '1px solid #D6CEBE',
            background: tab === 'docs' ? '#275641' : '#FFFFFF',
            color: tab === 'docs' ? '#FFFFFF' : '#1E293B',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Hồ sơ công khai & 3 Hash
        </button>
      </div>

      {tab === 'temp' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Biểu đồ nhiệt độ */}
          <div
            className="card"
            style={{
              padding: 22,
              borderRadius: 20,
              border: '1px solid var(--line, #E8E2D9)',
              background: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#1E293B' }}>
                  Biểu đồ nhiệt độ vận chuyển
                </h2>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Vùng an toàn: <strong>{TEMP_MIN_C}°C – {TEMP_MAX_C}°C</strong> · Điểm vượt ngưỡng hiển thị màu đỏ
                </div>
              </div>
              {batch.hasTempAlert && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 12px',
                    borderRadius: 999,
                    background: '#FEE2E2',
                    color: '#DC2626',
                  }}
                >
                  Cảnh báo: Có điểm vượt ngưỡng 8–15°C
                </span>
              )}
            </div>

            {points.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                Chưa có bản ghi nhiệt độ nào cho lô này.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', maxHeight: 240 }}>
                  {/* Vùng ngưỡng an toàn 8 - 15°C */}
                  <rect
                    x={padL}
                    y={yOf(TEMP_MAX_C)}
                    width={chartW - padL - padR}
                    height={yOf(TEMP_MIN_C) - yOf(TEMP_MAX_C)}
                    fill="#DCFCE7"
                    opacity={0.65}
                  />
                  {/* Đường giới hạn 15°C và 8°C */}
                  {[TEMP_MAX_C, TEMP_MIN_C].map((t) => (
                    <g key={t}>
                      <line
                        x1={padL}
                        x2={chartW - padR}
                        y1={yOf(t)}
                        y2={yOf(t)}
                        stroke="#16A34A"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text x={6} y={yOf(t) + 4} fontSize="11" fill="#15803D" fontWeight="600">
                        {t}°C
                      </text>
                    </g>
                  ))}
                  {/* Đường nối các điểm */}
                  {points.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#275641"
                      strokeWidth="2.5"
                      points={polyline}
                    />
                  )}
                  {/* Các điểm đo */}
                  {points.map((p) => (
                    <g key={p.readingId}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={6}
                        fill={p.outOfRange ? '#DC2626' : '#16A34A'}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <text
                        x={p.x}
                        y={p.y - 10}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={p.outOfRange ? '#DC2626' : '#1E293B'}
                      >
                        {p.tempC}°C
                      </text>
                      <text
                        x={p.x}
                        y={chartH - 10}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#64748B"
                      >
                        #{p.readingId}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* Form ghi nhiệt độ mới (Luồng LC) */}
          <div
            className="card"
            style={{
              padding: 22,
              borderRadius: 20,
              border: '1px solid var(--line, #E8E2D9)',
              background: '#FFFFFF',
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px 0', color: '#1E293B' }}>
              Ghi bản ghi nhiệt độ mới (recordTransit)
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px 0' }}>
              Dữ liệu được ghi trực tiếp lên hợp đồng FoodTraceability. Nhiệt độ ngoài khoảng 8°C – 15°C sẽ gắn cờ cảnh báo.
            </p>

            {!canRecordTransit ? (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#FAF7F2',
                  color: '#78716C',
                  fontSize: 13,
                }}
              >
                Lô hiện không thể ghi thêm nhiệt độ (cần thuộc quyền giữ của Logistics, ở trạng thái InTransit, chưa hết hạn/thu hồi và không có yêu cầu bàn giao đang chờ).
              </div>
            ) : (
              <form onSubmit={handleRecordTransit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Nhiệt độ (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tempInput}
                      onChange={(e) => setTempInput(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #D6CEBE',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                    {previewOutOfRange && (
                      <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4, fontWeight: 600 }}>
                        Cảnh báo: Nhiệt độ này vượt ngưỡng an toàn 8°C – 15°C!
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Thời điểm đo
                    </label>
                    <input
                      type="datetime-local"
                      value={observedInput}
                      onChange={(e) => setObservedInput(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #D6CEBE',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Vị trí / Chặng vận chuyển
                    </label>
                    <input
                      type="text"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      placeholder="Ví dụ: Trạm trung chuyển Mỹ Tho"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #D6CEBE',
                        fontSize: 14,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {txError && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>
                    {txError}
                  </div>
                )}
                {txStatus && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EBF7EE', color: '#15803D', fontSize: 13 }}>
                    {txStatus}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '11px 22px',
                      borderRadius: 12,
                      border: 'none',
                      background: submitting ? '#94A3B8' : '#275641',
                      color: '#FFFFFF',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Đang xử lý giao dịch…' : 'Ghi nhiệt độ lên blockchain'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Bảng lịch sử bản ghi nhiệt độ */}
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
                  <th style={{ padding: '12px 16px' }}>ID</th>
                  <th style={{ padding: '12px 16px' }}>Nhiệt độ</th>
                  <th style={{ padding: '12px 16px' }}>Vị trí</th>
                  <th style={{ padding: '12px 16px' }}>Giờ đo</th>
                  <th style={{ padding: '12px 16px' }}>Giờ block</th>
                  <th style={{ padding: '12px 16px' }}>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {batch.readings.map((r) => (
                  <tr
                    key={r.readingId}
                    style={{
                      borderBottom: '1px solid #F1ECE4',
                      background: r.outOfRange ? '#FEF2F2' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{r.readingId}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: r.outOfRange ? '#DC2626' : '#16A34A' }}>
                      {r.tempC}°C {r.outOfRange ? '(Vượt ngưỡng)' : ''}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{r.location}</td>
                    <td style={{ padding: '12px 16px' }}>{new Date(r.observedAt).toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '12px 16px' }}>{new Date(r.blockTime).toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                      {r.txHash.slice(0, 10)}…{r.txHash.slice(-6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tab 3 hash hồ sơ công khai */
        <div
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#1E293B' }}>
                3 Hash SHA-256 hồ sơ công khai lưu trên blockchain
              </h2>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                Metadata CID: <code style={{ fontFamily: 'monospace' }}>{batch.metadataCid}</code>
              </div>
            </div>
            <button
              type="button"
              disabled={verifying}
              onClick={handleVerifyHashes}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                border: 'none',
                background: '#275641',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: verifying ? 'not-allowed' : 'pointer',
              }}
            >
              {verifying ? 'Đang tải & băm IPFS…' : 'Đối chiếu SHA-256 với tệp IPFS'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {[
              { key: 'metadata', title: '1. metadata.json', hash: batch.metadataHash },
              { key: 'certificate', title: '2. certificate.pdf', hash: batch.certificateHash },
              { key: 'image', title: '3. batch.jpg', hash: batch.imageHash },
            ].map((item) => {
              const checked = verifyResults?.find((r) => r.key === item.key)
              return (
                <div
                  key={item.key}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    border: '1px solid #E8E2D9',
                    background: '#FAF9F6',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 14, color: '#1E293B' }}>{item.title}</strong>
                    {checked && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: checked.matched ? '#DCFCE7' : '#FEE2E2',
                          color: checked.matched ? '#15803D' : '#DC2626',
                        }}
                      >
                        {checked.matched ? 'KHỚP SHA-256' : 'KHÔNG KHỚP'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Hash trên chain:</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', color: '#334155' }}>
                    {item.hash}
                  </div>
                  {checked?.actualHash && (
                    <>
                      <div style={{ fontSize: 11, color: '#64748B' }}>SHA-256 tải từ IPFS:</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', color: '#334155' }}>
                        {checked.actualHash}
                      </div>
                    </>
                  )}
                  {checked?.error && (
                    <div style={{ fontSize: 12, color: '#DC2626' }}>{checked.error}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
