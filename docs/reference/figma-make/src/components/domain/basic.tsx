import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Batch, Lifecycle, RoleKey, WalletRec } from '../../types'
import { Icon, Copy, type IconName } from '../ui'
import { shortAddr, shortHash } from '../../lib/format'
import { isExpired } from '../../store/rules'
import { useStore } from '../../store'

export function Logo({ size = 40, light = false, to = '/' }: { size?: number; light?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="COCOMARK - Trang chủ">
      <img src="/brand/Primary.svg" alt="" width={size} height={size} style={{ width: size, height: size }} />
      <span className={`text-[19px] font-extrabold tracking-[0.04em] ${light ? 'text-ivory' : 'text-cocoa'}`}>COCOMARK</span>
    </Link>
  )
}

const ROLE: Record<RoleKey, { label: string; cls: string; icon: IconName }> = {
  admin: { label: 'Admin', cls: 'bg-cocoa text-ivory', icon: 'shield' },
  farmer: { label: 'Farmer', cls: 'bg-forest text-white', icon: 'leaf' },
  logistics: { label: 'Logistics', cls: 'bg-harvest text-cocoa', icon: 'truck' },
  retailer: { label: 'Retailer', cls: 'bg-[#8a5a2b] text-white', icon: 'store' },
}
export const roleLabel = (r: RoleKey) => ROLE[r].label
export function RoleBadge({ role }: { role: RoleKey | null }) {
  if (!role) return <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-0.5 text-xs font-semibold text-cocoa-soft"><Icon name="lock" className="size-3" />Chưa có role</span>
  const r = ROLE[role]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.cls}`}><Icon name={r.icon} className="size-3" />{r.label}</span>
}

export function WalletChip({ wallet, compact }: { wallet?: Pick<WalletRec, 'label' | 'address'>; compact?: boolean }) {
  if (!wallet) return <span className="text-cocoa-soft">—</span>
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-white py-1 pl-2.5 pr-1.5 text-xs">
      <Icon name="wallet" className="size-3.5 text-forest" />
      {!compact && <span className="font-semibold">{wallet.label}</span>}
      <span className="font-mono text-cocoa-soft">{shortAddr(wallet.address)}</span>
      <Copy text={wallet.address} label="Sao chép địa chỉ ví" />
    </span>
  )
}
export function useWallet(id: string | null | undefined) {
  const { state } = useStore()
  return state.wallets.find((w) => w.id === id)
}
export function OwnerChip({ id }: { id: string }) {
  return <WalletChip wallet={useWallet(id)} />
}

export function NetworkBadge({ wrong }: { wrong?: boolean }) {
  return wrong ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger"><Icon name="alert" className="size-3.5" />Sai mạng</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage px-2.5 py-1 text-xs font-semibold text-forest-dark"><span className="size-2 rounded-full bg-forest" />Sepolia testnet · 11155111</span>
  )
}

const LC: Record<Lifecycle, { label: string; cls: string }> = {
  Created: { label: 'Created · Đã tạo', cls: 'bg-ivory text-cocoa border-line' },
  InTransit: { label: 'InTransit · Đang vận chuyển', cls: 'bg-cream text-harvest-dark border-harvest/50' },
  Delivered: { label: 'Delivered · Đã giao', cls: 'bg-sage text-forest-dark border-forest/30' },
  Sold: { label: 'Sold · Đã bán', cls: 'bg-forest text-white border-forest' },
}
export const StatusBadge = ({ status }: { status: Lifecycle }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${LC[status].cls}`}>{LC[status].label}</span>
)
export function ExpiryBadge({ batch }: { batch: Batch }) {
  const { state } = useStore()
  if (!isExpired(batch, state)) return null
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-harvest bg-harvest/25 px-2.5 py-0.5 text-xs font-bold text-harvest-dark"><Icon name="clock" className="size-3" />Hết hạn</span>
}
export const RecallBadge = ({ batch }: { batch: Batch }) =>
  batch.recalled ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white"><Icon name="warn" className="size-3" />Đã thu hồi</span> : null
export function BatchBadges({ batch }: { batch: Batch }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusBadge status={batch.lifecycle} />
      <ExpiryBadge batch={batch} />
      <RecallBadge batch={batch} />
    </span>
  )
}

export function RecallBanner({ batch, large }: { batch: Batch; large?: boolean }) {
  if (!batch.recalled || !batch.recall) return null
  return (
    <div role="alert" className={`rounded-2xl border-2 border-danger bg-danger-soft ${large ? 'p-5' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger text-white"><Icon name="warn" className="size-5" /></span>
        <div>
          <p className="text-lg font-extrabold text-danger">Đã thu hồi</p>
          <p className="text-sm text-cocoa">Lô này đã bị thu hồi theo sự cố <b className="font-mono">{batch.recall.incidentId}</b>. Vui lòng không sử dụng hoặc bán tiếp và liên hệ nơi mua.</p>
          <p className="mt-1 text-xs text-cocoa-soft">Thu hồi không xóa lịch sử sự kiện hay quyền sở hữu NFT. Trạng thái vòng đời ({batch.lifecycle}) vẫn được giữ nguyên.</p>
        </div>
      </div>
    </div>
  )
}

export function LifecycleStepper({ status, compact }: { status: Lifecycle; compact?: boolean }) {
  const steps: { k: Lifecycle; l: string }[] = [
    { k: 'Created', l: 'Đã tạo' },
    { k: 'InTransit', l: 'Vận chuyển' },
    { k: 'Delivered', l: 'Đã giao' },
    { k: 'Sold', l: 'Đã bán' },
  ]
  const idx = steps.findIndex((s) => s.k === status)
  return (
    <ol className="flex w-full items-center" aria-label="Vòng đời lô">
      {steps.map((s, i) => (
        <li key={s.k} className={`flex items-center ${i < 3 ? 'flex-1' : ''}`} aria-current={i === idx ? 'step' : undefined}>
          <div className="flex flex-col items-center gap-1">
            <span className={`grid size-7 place-items-center rounded-full border-2 text-xs font-bold ${i < idx ? 'border-forest bg-forest text-white' : i === idx ? 'border-forest bg-sage text-forest-dark' : 'border-line bg-white text-cocoa-soft'}`}>
              {i < idx ? <Icon name="check" className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            {!compact && <span className={`text-[11px] font-semibold ${i <= idx ? 'text-cocoa' : 'text-cocoa-soft'}`}>{s.l}</span>}
          </div>
          {i < 3 && <span className={`mx-1 mb-4 h-0.5 flex-1 ${i < idx ? 'bg-forest' : 'bg-line'} ${compact ? 'mb-0' : ''}`} />}
        </li>
      ))}
    </ol>
  )
}

export function IPFSCIDChip({ cid, label = 'CID' }: { cid: string; label?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-ivory px-2 py-1 font-mono text-[11.5px]">
      <span className="font-sans font-semibold text-cocoa-soft">{label}</span>
      <span className="truncate" title={cid}>{shortHash(cid, 7)}</span>
      <Copy text={cid} label={`Sao chép ${label}`} />
    </span>
  )
}
export function HashChip({ hash, label = 'SHA-256' }: { hash: string; label?: string }) {
  return <IPFSCIDChip cid={hash} label={label} />
}
export function TxChip({ tx }: { tx: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-cocoa-soft" title="txHash tạo sẵn cho bản demo, không phải bản ghi đã xác nhận trên Sepolia">
      {shortHash(tx, 6)}
      <Copy text={tx} label="Sao chép txHash" />
    </span>
  )
}

export function FormStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-2" aria-label="Các bước">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${i === current ? 'border-forest bg-sage text-forest-dark' : i < current ? 'border-forest/30 bg-white text-forest' : 'border-line bg-white text-cocoa-soft'}`}>
          <span className={`grid size-5 place-items-center rounded-full text-[11px] ${i < current ? 'bg-forest text-white' : i === current ? 'bg-forest text-white' : 'bg-line text-cocoa-soft'}`}>{i < current ? <Icon name="check" className="size-3" strokeWidth={3} /> : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  )
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-cocoa-soft">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  )
}
