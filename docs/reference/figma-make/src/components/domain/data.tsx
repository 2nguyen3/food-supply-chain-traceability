import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import type { Batch, ChainEvent, FileRef } from '../../types'
import { Button, Card, Icon, Modal, Notice, Table, ErrorState, type IconName } from '../ui'
import { BatchBadges, HashChip, IPFSCIDChip, OwnerChip, TxChip, useWallet, WalletChip } from './basic'
import { buildTraceUrl, fmtDate, fmtDateTime, shortAddr } from '../../lib/format'
import { metadataJson } from '../../lib/metadata'
import { FILE_ORDER, simulateHash, type FileKind, canGrant, canReadPrivateDoc, getBatch } from '../../store/rules'
import { useStore } from '../../store'

/* ---------------- Timeline ---------------- */
const EV: Record<ChainEvent['type'], { label: string; icon: IconName; tone: string }> = {
  BatchCreated: { label: 'Khởi tạo lô và mint NFT', icon: 'leaf', tone: 'bg-forest text-white' },
  TransferAccepted: { label: 'Bàn giao đã xác nhận', icon: 'route', tone: 'bg-harvest text-cocoa' },
  TransitRecorded: { label: 'Bản ghi vận chuyển', icon: 'thermo', tone: 'bg-cream text-harvest-dark border border-harvest/50' },
  BatchSold: { label: 'Đã bán', icon: 'store', tone: 'bg-cocoa text-ivory' },
  IncidentReported: { label: 'Báo cáo sự cố', icon: 'flag', tone: 'bg-danger-soft text-danger border border-danger/30' },
  BatchRecalled: { label: 'Thu hồi lô', icon: 'warn', tone: 'bg-danger text-white' },
}
export function Timeline({ events, collapseTransit = true }: { events: ChainEvent[]; collapseTransit?: boolean }) {
  const sorted = [...events].sort((a, b) => a.at - b.at)
  const transit = sorted.filter((e) => e.type === 'TransitRecorded')
  const items = collapseTransit && transit.length > 1 ? sorted.filter((e) => e.type !== 'TransitRecorded' || e === transit[0]) : sorted
  return (
    <ol className="relative space-y-5 border-l-2 border-line pl-6">
      {items.map((e) => {
        const m = EV[e.type]
        const grouped = collapseTransit && transit.length > 1 && e === transit[0]
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[37px] grid size-7 place-items-center rounded-full ring-4 ring-white ${m.tone}`}><Icon name={m.icon} className="size-3.5" /></span>
            <p className="text-[15px] font-semibold">{grouped ? `${transit.length} bản ghi vận chuyển (TransitRecorded)` : m.label}</p>
            <p className="text-sm text-cocoa-soft">{grouped ? `Từ ${fmtDateTime(transit[0].at)} · nhiệt độ ${transit.map((t) => t.detail.match(/(\d+\.\d)°C/)?.[1]).join(', ')}°C` : e.detail}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-cocoa-soft">
              <span>{fmtDateTime(e.at)}</span>·<TxChip tx={e.tx} />
            </p>
          </li>
        )
      })}
    </ol>
  )
}

export function NFTTransferHistory({ batch }: { batch: Batch }) {
  const { state } = useStore()
  const label = (id: string) => (id === 'zero' ? '0x0000…0000 (mint)' : (state.wallets.find((w) => w.id === id)?.label ?? id))
  return (
    <div>
      <ol className="space-y-3">
        {batch.transfers.map((t, i) => (
          <li key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ivory/60 p-3 text-sm">
            <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-semibold">Transfer #{i + 1}</span>
            <span className="font-semibold">{label(t.from)}</span>
            <Icon name="arrow" className="size-4 text-cocoa-soft" />
            <span className="font-semibold">{label(t.to)}</span>
            <span className="ml-auto flex flex-wrap items-center gap-2 text-xs text-cocoa-soft">{fmtDateTime(t.at)} <TxChip tx={t.tx} /></span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-cocoa-soft">Lịch sử ERC-721 Transfer liệt kê mỗi lần đổi chủ đúng một lần (bao gồm mint từ địa chỉ 0x0). Khác với dòng thời gian vận hành ở tab Hành trình.</p>
    </div>
  )
}

/* ---------------- Temperature ---------------- */
export function TemperatureChart({ batch }: { batch: Batch }) {
  const rs = batch.readings
  if (!rs.length) return null
  const W = 640, H = 260, L = 44, B = 36, T = 16, Rr = 16
  const lo = Math.min(4, ...rs.map((r) => r.tempC100 / 100 - 2)), hi = Math.max(22, ...rs.map((r) => r.tempC100 / 100 + 2))
  const y = (c: number) => T + (1 - (c - lo) / (hi - lo)) * (H - T - B)
  const x = (i: number) => L + (i / Math.max(rs.length - 1, 1)) * (W - L - Rr)
  const path = rs.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.tempC100 / 100)}`).join(' ')
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Biểu đồ nhiệt độ: ${rs.map((r) => r.tempC100 / 100).join(', ')} độ C`} className="w-full">
        <rect x={L} y={y(batch.maxTemp)} width={W - L - Rr} height={y(batch.minTemp) - y(batch.maxTemp)} fill="#d8e8d1" opacity=".7" />
        {[...Array(Math.floor((hi - lo) / 4) + 1)].map((_, i) => {
          const v = Math.ceil(lo / 4) * 4 + i * 4
          return v <= hi ? <g key={v}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} stroke="#e6e1d3" /><text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b5a44">{v}°</text></g> : null
        })}
        <text x={W - Rr - 4} y={y(batch.maxTemp) - 4} textAnchor="end" fontSize="11" fill="#235640" fontWeight="600">Ngưỡng {batch.minTemp}–{batch.maxTemp}°C</text>
        <path d={path} fill="none" stroke="#2d6a4f" strokeWidth="2.5" strokeLinejoin="round" />
        {rs.map((r, i) => {
          const c = r.tempC100 / 100
          const out = c > batch.maxTemp || c < batch.minTemp
          return (
            <g key={r.id}>
              {out ? <path d={`M${x(i)},${y(c) - 11} l9,16 h-18z`} fill="#b42318" /> : <circle cx={x(i)} cy={y(c)} r="5" fill="#fff" stroke="#2d6a4f" strokeWidth="2.5" />}
              <text x={x(i)} y={out ? y(c) - 16 : y(c) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill={out ? '#b42318' : '#463721'}>{c}°C</text>
              <text x={x(i)} y={H - 14} textAnchor="middle" fontSize="11" fill="#6b5a44">#{r.id}</text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-cocoa-soft">Giá trị đọc từ CSV bởi script Python/Web3.py (không phải cảm biến vật lý). Vùng xanh là ngưỡng minh họa trong metadata.</figcaption>
    </figure>
  )
}
export function ReadingsTable({ batch }: { batch: Batch }) {
  const out = batch.readings.filter((r) => r.tempC100 / 100 > batch.maxTemp || r.tempC100 / 100 < batch.minTemp)
  return (
    <div className="space-y-3">
      {out.length > 0 && (
        <Notice tone="warn" title={`Vượt ngưỡng nhiệt độ: ${out.map((r) => r.tempC100 / 100 + '°C').join(', ')}`}>
          Đây là một lần vượt ngưỡng nhiệt độ ghi nhận trong dữ liệu vận chuyển, không tự động là bằng chứng nhiễm khuẩn hay mất an toàn thực phẩm.
        </Notice>
      )}
      <Table head={['readingId', 'Nhiệt độ', 'observedAt (thời điểm đọc)', 'Thời điểm block ghi', 'Vị trí', 'txHash']}>
        {batch.readings.map((r) => {
          const bad = r.tempC100 / 100 > batch.maxTemp || r.tempC100 / 100 < batch.minTemp
          return (
            <tr key={r.id} className={bad ? 'bg-danger-soft/60' : ''}>
              <td className="px-4 py-3 font-mono">#{r.id}</td>
              <td className="px-4 py-3 font-semibold">{bad && <Icon name="warn" className="mr-1 inline size-4 text-danger" />}{(r.tempC100 / 100).toFixed(1)}°C <span className="font-mono text-xs font-normal text-cocoa-soft">({r.tempC100} centi°C)</span>{bad && <span className="ml-1 text-xs text-danger"> · vượt ngưỡng</span>}</td>
              <td className="px-4 py-3">{fmtDateTime(r.observedAt)}</td>
              <td className="px-4 py-3">{fmtDateTime(r.blockAt)}</td>
              <td className="px-4 py-3">{r.location}</td>
              <td className="px-4 py-3"><TxChip tx={r.tx} /></td>
            </tr>
          )
        })}
      </Table>
    </div>
  )
}

/* ---------------- QR ---------------- */
export function QRCard({ batch, compact }: { batch: Batch; compact?: boolean }) {
  const { toast } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  const url = buildTraceUrl({ mode: 'demo', batchCode: batch.code })
  const prod = buildTraceUrl({ mode: 'production', chainId: 11155111, contractAddress: '0x…(địa chỉ hợp đồng khi triển khai)', tokenId: batch.tokenId })
  const download = () => {
    const c = ref.current?.querySelector('canvas')
    if (!c) return
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `qr-${batch.code}.png`
    a.click()
    toast('Đã tải ảnh QR (URL demo)', 'info')
  }
  return (
    <Card className={compact ? '' : 'grid gap-6 md:grid-cols-[auto_1fr]'}>
      <div className="mx-auto">
        <div ref={ref} className="rounded-2xl border border-line bg-white p-3">
          <QRCodeCanvas value={url} size={512} level="M" marginSize={1} style={{ width: compact ? 176 : 208, height: compact ? 176 : 208 }} />
        </div>
        <p className="mt-2 text-center text-sm font-bold text-cocoa">{batch.code}</p>
      </div>
      <div className="min-w-0 space-y-4">
        <h3 className="text-base">Mã QR truy xuất</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon="copy" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); toast('Đã sao chép liên kết', 'info') }}>Sao chép liên kết</Button>
          <Link to={`/trace/demo/${batch.code}`} target="_blank"><span className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[13px] font-semibold hover:bg-cream"><Icon name="external" />Mở trang truy xuất</span></Link>
          <Button size="sm" variant="secondary" icon="download" onClick={download}>Tải mã QR</Button>
        </div>
        <details className="group rounded-xl border border-line bg-ivory/60">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-semibold">Thông tin kỹ thuật<Icon name="down" className="transition-transform group-open:rotate-180" /></summary>
          <div className="space-y-3 border-t border-line p-3">
            <div><p className="text-xs text-cocoa-soft">URL được mã hóa trong QR (bản demo)</p><p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">{url}</p></div>
            <div><p className="text-xs text-cocoa-soft">URL chuẩn khi triển khai chính thức</p><p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-cocoa-soft">{prod}</p></div>
            <p className="text-xs text-cocoa-soft">QR chỉ chứa địa chỉ công khai, không chứa khóa, hóa đơn hay trạng thái. URL demo không phải URL của hợp đồng đã triển khai. Dữ liệu demo nằm trong trình duyệt, nên thiết bị khác chỉ mở được trang nếu truy cập được URL này và sẽ thấy dữ liệu ban đầu, không đồng bộ trạng thái.</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-cocoa-soft"><IPFSCIDChip cid={batch.files.metadata.cid} label="tokenURI" /><span className="font-mono">{batch.tokenURI.slice(0, 22)}…</span></div>
          </div>
        </details>
      </div>
    </Card>
  )
}

/* ---------------- Files ---------------- */
const KIND: Record<FileKind, { label: string; icon: IconName; sub: string }> = {
  metadata: { label: 'metadata.json', icon: 'json', sub: 'Metadata JSON công khai' },
  certificate: { label: 'certificate.pdf', icon: 'file', sub: 'PDF chứng chỉ gốc' },
  image: { label: 'batch.jpg', icon: 'image', sub: 'Ảnh gốc của lô' },
}
export const kindLabel = (k: FileKind) => KIND[k]

export function FileCard({ batch, kind, onVerified }: { batch: Batch; kind: FileKind; onVerified?: (ok: boolean) => void }) {
  const { state } = useStore()
  const f = batch.files[kind]
  const [open, setOpen] = useState(false)
  const [st, setSt] = useState<'idle' | 'busy' | 'ok' | 'mismatch' | 'error'>('idle')
  const verify = () => {
    setSt('busy')
    setTimeout(() => {
      const r = simulateHash(batch, kind, state)
      setSt(r.status)
      onVerified?.(r.status === 'ok')
    }, 700)
  }
  const json = JSON.stringify(metadataJson(batch), null, 2)
  const rawHref = kind === 'certificate' ? '/fixtures/certificate.pdf' : kind === 'image' ? batch.photo : `data:application/json;charset=utf-8,${encodeURIComponent(json)}`
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sage text-forest"><Icon name={KIND[kind].icon} className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{KIND[kind].label} <span className="ml-1 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-harvest-dark">FIXTURE</span></p>
          <p className="text-xs text-cocoa-soft">{KIND[kind].sub} · {(f.size / 1024).toFixed(0)} KB</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><IPFSCIDChip cid={f.cid} /><HashChip hash={f.sha256} /></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" icon="eye" onClick={() => setOpen(true)}>Xem bản gốc</Button>
        <a href={rawHref} target="_blank" rel="noreferrer" download={kind === 'metadata' ? 'metadata.json' : undefined} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[13px] font-semibold hover:bg-cream"><Icon name="download" />Mở/tải tệp</a>
        <Button size="sm" variant="ghost" icon="hash" onClick={verify} disabled={st === 'busy'}>Kiểm tra SHA-256</Button>
      </div>
      <p role="status" className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${st === 'ok' ? 'text-forest' : st === 'idle' || st === 'busy' ? 'text-cocoa-soft' : 'text-danger'}`}>
        <Icon name={st === 'ok' ? 'check' : st === 'mismatch' || st === 'error' ? 'alert' : 'info'} className="size-3.5" />
        {st === 'idle' && 'Chưa đối chiếu SHA-256.'}
        {st === 'busy' && 'Đang đối chiếu…'}
        {st === 'ok' && 'Khớp SHA-256 đã công bố. Không đồng nghĩa an toàn thực phẩm.'}
        {st === 'mismatch' && 'SHA-256 không khớp: tệp có thể đã bị thay đổi.'}
        {st === 'error' && 'Không tải được từ IPFS. Hãy thử lại.'}
      </p>
      <Modal open={open} onClose={() => setOpen(false)} title={KIND[kind].label + ' - bản gốc (fixture)'} wide>
        {kind === 'metadata' && <pre className="overflow-x-auto rounded-xl bg-ivory p-4 font-mono text-xs">{json}</pre>}
        {kind === 'image' && <img src={batch.photo} alt={`Ảnh gốc lô ${batch.code}`} className="w-full rounded-xl" />}
        {kind === 'certificate' && <CertificatePreview batch={batch} />}
      </Modal>
    </div>
  )
}
export function CertificatePreview({ batch }: { batch: Batch }) {
  return (
    <div className="rounded-xl border-2 border-double border-cocoa/40 bg-cream p-6 text-center">
      <img src="/brand/Primary.svg" alt="" className="mx-auto size-14" />
      <p className="mt-2 text-xs font-semibold tracking-[0.2em]">COCOMARK</p>
      <h3 className="mt-1 text-xl">Giấy chứng nhận lô dừa</h3>
      <p className="mt-1 text-sm text-cocoa-soft">Số {batch.code} · Mẫu cho prototype</p>
      <dl className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2 text-left text-sm">
        <dt className="text-cocoa-soft">Trang trại</dt><dd>{batch.farmId} · {batch.farmLocation}</dd>
        <dt className="text-cocoa-soft">Nhóm thu hoạch</dt><dd>{batch.groupId}</dd>
        <dt className="text-cocoa-soft">Giống</dt><dd>{batch.variety}</dd>
        <dt className="text-cocoa-soft">Khối lượng</dt><dd>1.000 kg</dd>
        <dt className="text-cocoa-soft">Thu hoạch</dt><dd>{fmtDate(batch.harvestDate)}</dd>
      </dl>
      <p className="mt-4 text-xs text-cocoa-soft">Đây là bản xem trước trong ứng dụng. Tệp PDF mẫu: <a className="underline" href="/fixtures/certificate.pdf" target="_blank" rel="noreferrer">mở certificate.pdf (fixture)</a>. Không phải chứng chỉ thật.</p>
    </div>
  )
}

/* ---------------- Hash verification ---------------- */
type HS = 'idle' | 'busy' | 'ok' | 'mismatch' | 'error' | 'skipped'
export function HashVerificationPanel({ batch, onChange }: { batch: Batch; onChange: (checked: Record<FileKind, boolean>) => void }) {
  const { state } = useStore()
  const stateRef = useRef(state)
  stateRef.current = state
  const [st, setSt] = useState<Record<FileKind, HS>>({ metadata: 'idle', certificate: 'idle', image: 'idle' })
  const [calc, setCalc] = useState<Partial<Record<FileKind, string>>>({})
  const [running, setRunning] = useState(false)
  useEffect(() => onChange({ metadata: st.metadata === 'ok', certificate: st.certificate === 'ok', image: st.image === 'ok' }), [st]) // eslint-disable-line
  const run = async () => {
    setRunning(true)
    setCalc({})
    const cur: Record<FileKind, HS> = { metadata: 'idle', certificate: 'idle', image: 'idle' }
    setSt({ ...cur })
    let failed = false
    for (const k of FILE_ORDER) {
      if (failed) { cur[k] = 'skipped'; setSt({ ...cur }); continue }
      cur[k] = 'busy'; setSt({ ...cur })
      await new Promise((r) => setTimeout(r, 900))
      const r = simulateHash(batch, k, stateRef.current)
      cur[k] = r.status
      if (r.computed) setCalc((c) => ({ ...c, [k]: r.computed }))
      setSt({ ...cur })
      if (r.status !== 'ok') failed = true
    }
    setRunning(false)
  }
  const allOk = FILE_ORDER.every((k) => st[k] === 'ok')
  const anyFail = FILE_ORDER.some((k) => st[k] === 'mismatch' || st[k] === 'error')
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-base">Xác minh 3 hash SHA-256 (raw bytes)</h3><p className="text-xs text-cocoa-soft">Thứ tự bắt buộc: metadata JSON → certificate PDF → ảnh gốc.</p></div>
        <Button icon="play" size="sm" onClick={run} disabled={running}>{running ? 'Đang xác minh…' : allOk || anyFail ? 'Xác minh lại' : 'Bắt đầu xác minh'}</Button>
      </div>
      <ol className="space-y-2">
        {FILE_ORDER.map((k, i) => {
          const s = st[k]
          return (
            <li key={k} className={`rounded-xl border p-3 ${s === 'ok' ? 'border-forest/30 bg-sage/40' : s === 'mismatch' || s === 'error' ? 'border-danger/40 bg-danger-soft' : 'border-line bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-white text-xs font-bold ring-1 ring-line">{i + 1}</span>
                <Icon name={KIND[k].icon} className="size-4" />
                <span className="font-semibold">{KIND[k].label}</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
                  {s === 'idle' && <span className="text-cocoa-soft">Chưa kiểm tra</span>}
                  {s === 'skipped' && <span className="text-cocoa-soft">Bỏ qua do bước trước thất bại</span>}
                  {s === 'busy' && <><span className="animate-spin-slow size-3.5 rounded-full border-2 border-sage border-t-forest" />Đang xác minh…</>}
                  {s === 'ok' && <span className="flex items-center gap-1 text-forest"><Icon name="check" className="size-3.5" />Khớp</span>}
                  {s === 'mismatch' && <span className="flex items-center gap-1 text-danger"><Icon name="alert" className="size-3.5" />Hash không khớp</span>}
                  {s === 'error' && <span className="flex items-center gap-1 text-danger"><Icon name="alert" className="size-3.5" />Không tải được từ IPFS</span>}
                </span>
              </div>
              {(s === 'ok' || s === 'mismatch') && calc[k] && (
                <div className="mt-2 grid gap-1 font-mono text-[11px] text-cocoa-soft">
                  <span>Trên chuỗi: {batch.files[k].sha256}</span>
                  <span className={s === 'mismatch' ? 'font-semibold text-danger' : ''}>Tính lại:&nbsp;&nbsp;&nbsp;{calc[k]}</span>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-cocoa-soft">Khớp hash chỉ chứng minh tệp trùng với giá trị đã ghi, không chứng minh an toàn thực phẩm hay tính xác thực của chứng chỉ.</p>
    </Card>
  )
}

/* ---------------- Batch table / card ---------------- */
export function BatchTable({ batches, href, extra, extraHead }: { batches: Batch[]; href: (b: Batch) => string; extra?: (b: Batch) => React.ReactNode; extraHead?: string }) {
  return (
    <Table head={['Mã lô', 'Token', 'Farm / Nhóm', 'Chủ sở hữu NFT', 'Trạng thái', 'Hạn dùng', ...(extraHead ? [extraHead] : [])]}>
      {batches.map((b) => (
        <tr key={b.tokenId} className="hover:bg-ivory/70">
          <td className="px-4 py-3"><Link to={href(b)} className="font-semibold text-forest hover:underline">{b.code}</Link><div className="text-xs text-cocoa-soft">1.000 kg · 1 NFT</div></td>
          <td className="px-4 py-3 font-mono">#{b.tokenId}</td>
          <td className="px-4 py-3">{b.farmId}<div className="text-xs text-cocoa-soft">{b.groupId}</div></td>
          <td className="px-4 py-3"><OwnerChip id={b.owner} /></td>
          <td className="px-4 py-3"><BatchBadges batch={b} /></td>
          <td className="px-4 py-3">{fmtDate(b.expiryDate)}</td>
          {extra && <td className="px-4 py-3">{extra(b)}</td>}
        </tr>
      ))}
    </Table>
  )
}
export function BatchCard({ batch, to }: { batch: Batch; to: string }) {
  return (
    <Link to={to} className="group overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-md">
      <img src={batch.photo} alt={`Lô ${batch.code}`} className="h-28 w-full object-cover" loading="lazy" />
      <div className="p-4">
        <div className="flex items-center justify-between"><p className="font-bold group-hover:text-forest">{batch.code}</p><span className="font-mono text-xs text-cocoa-soft">#{batch.tokenId}</span></div>
        <p className="text-xs text-cocoa-soft">{batch.farmId} · {batch.groupId}</p>
        <div className="mt-2"><BatchBadges batch={batch} /></div>
      </div>
    </Link>
  )
}

/* ---------------- Private documents ---------------- */
export function PrivateDocPanel({ batch }: { batch: Batch }) {
  const { state, actor, docSessionValid, startDocSession, runTx, toast } = useStore()
  const doc = state.docs.find((d) => d.tokenId === batch.tokenId)
  const [signing, setSigning] = useState(false)
  if (!doc) return <Notice tone="info">Lô này chưa có hóa đơn bán buôn riêng. Farmer có thể tải lên ở bước 3 của trình tạo lô.</Notice>
  const read = canReadPrivateDoc(state, actor?.id ?? null, doc, docSessionValid)
  const isOwner = actor?.id === doc.uploader
  const targets = state.wallets.filter((w) => w.role === 'logistics' || w.role === 'retailer')
  const toggle = (id: string, mode: 'grant' | 'revoke') => {
    const w = state.wallets.find((x) => x.id === id)!
    void runTx({
      title: mode === 'grant' ? 'Cấp quyền đọc hóa đơn' : 'Thu hồi quyền đọc hóa đơn',
      fn: mode === 'grant' ? 'grantDocAccess' : 'revokeDocAccess',
      summary: [{ label: 'Tài liệu', value: doc.name }, { label: 'Ví', value: `${w.label} (${shortAddr(w.address)})` }],
      validate: (s) => canGrant(s, actor!.id, s.docs.find((d) => d.id === doc.id)!, id, mode),
      action: (tx) => ({ type: 'docAcl', actor: actor!.id, docId: doc.id, target: id, mode, tx }),
      successMessage: mode === 'grant' ? `Đã cấp quyền cho ${w.label}` : `Đã thu hồi quyền của ${w.label}; các lần đọc sau sẽ bị từ chối`,
    })
  }
  return (
    <div className="space-y-4">
      <Notice tone="warn" title="Hóa đơn bán buôn riêng (ACL ngoài chuỗi)">
        Hóa đơn không công khai. Chỉ ví tải lên và ví được cấp quyền mới đọc được, sau khi ký phiên truy cập.
      </Notice>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-cream text-harvest-dark"><Icon name="lock" className="size-5" /></span>
          <div className="flex-1"><p className="font-semibold">{doc.name}</p><p className="text-xs text-cocoa-soft">{doc.id} · {doc.sizeKb} KB · gắn token #{doc.tokenId} · mã hóa riêng</p></div>
        </div>
        {read.ok ? (
          <div className="relative overflow-hidden rounded-xl border border-line bg-ivory p-4 text-sm">
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-4xl font-black uppercase tracking-widest text-cocoa/5 -rotate-12">Xem trước</span>
            <p className="font-semibold">Hóa đơn bán buôn số HDB-{String(batch.tokenId).padStart(4, '0')}</p>
            <p className="text-cocoa-soft">Bên bán: {batch.farmId} · Lô {batch.code} · 1.000 kg dừa nguyên trái</p>
            <p className="text-cocoa-soft">Nội dung giả lập, không có giá trị pháp lý.</p>
            <div className="mt-3"><Button size="sm" variant="secondary" icon="download" onClick={() => toast('Đã tải tệp', 'info')}>Tải xuống (mô phỏng)</Button></div>
          </div>
        ) : read.code === 'SESSION' && actor ? (
          <div className="rounded-xl border border-harvest/50 bg-cream p-4 text-sm">
            <p className="font-semibold">Cần ký phiên truy cập (20 phút)</p>
            <p className="mb-3 text-cocoa-soft">Phiên hết hạn hoặc chưa tạo. Ký lại để đọc tài liệu riêng.</p>
            <Button icon="key" onClick={() => { setSigning(true); setTimeout(() => { startDocSession(); setSigning(false); toast('Đã ký phiên truy cập 20 phút', 'info') }, 900) }} disabled={signing}>{signing ? 'Đang chờ chữ ký…' : 'Ký để xem tài liệu'}</Button>
          </div>
        ) : (
          <ErrorState title="403 - Không có quyền đọc tài liệu" desc={read.reason} />
        )}
      </Card>
      {isOwner && (
        <Card>
          <h3 className="mb-1 text-base">Quản lý quyền truy cập</h3>
          <p className="mb-3 text-xs text-cocoa-soft">Chỉ uploader (ví đã tải lên) được cấp hoặc thu hồi. Mỗi thay đổi được ghi thành một giao dịch.</p>
          <ul className="divide-y divide-line">
            {targets.map((w) => {
              const has = doc.grants.includes(w.id)
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                  <WalletChip wallet={w} />
                  <span className={`text-xs font-semibold ${has ? 'text-forest' : 'text-cocoa-soft'}`}>{has ? 'Đã được cấp quyền' : 'Chưa có quyền'}</span>
                  <span className="ml-auto"><Button size="sm" variant={has ? 'secondary' : 'primary'} onClick={() => toggle(w.id, has ? 'revoke' : 'grant')}>{has ? 'Thu hồi' : 'Cấp quyền đọc'}</Button></span>
                </li>
              )
            })}
          </ul>
          {doc.aclLog.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-1 text-xs font-semibold text-cocoa-soft">Lịch sử cấp quyền</p>
              <ul className="space-y-1 text-xs">{doc.aclLog.map((l, i) => <li key={i} className="flex flex-wrap gap-2"><span>{fmtDateTime(l.at)}</span><b>{l.action === 'grant' ? 'Cấp' : 'Thu hồi'}</b><span>{state.wallets.find((w) => w.id === l.walletId)?.label}</span><TxChip tx={l.tx} /></li>)}</ul>
            </div>
          )}
        </Card>
      )}
      {!isOwner && actor && <p className="text-xs text-cocoa-soft">Bạn đang xem với ví <b>{actor.label}</b>. Chỉ uploader mới thấy phần quản lý quyền.</p>}
    </div>
  )
}

export function FileRefRow({ f, label }: { f: FileRef; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="w-28 font-semibold">{label}</span><span className="text-xs text-cocoa-soft">{f.name}</span><IPFSCIDChip cid={f.cid} /><HashChip hash={f.sha256} /></div>
  )
}
export { getBatch, useWallet }
