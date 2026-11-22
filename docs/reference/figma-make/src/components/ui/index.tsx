import { Link } from 'react-router-dom'
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { useStore } from '../../store'

export { Icon }
export type { IconName }

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
const VAR: Record<Variant, string> = {
  primary: 'bg-forest text-white hover:bg-forest-dark disabled:bg-[#b9c9bf]',
  accent: 'bg-harvest text-cocoa hover:brightness-95 disabled:bg-[#efd9bd]',
  secondary: 'bg-white text-cocoa border border-line hover:bg-cream disabled:text-[#9b907f] disabled:bg-[#f6f4ee]',
  ghost: 'text-cocoa hover:bg-sage/50 disabled:text-[#9b907f]',
  danger: 'bg-danger text-white hover:brightness-110 disabled:bg-[#e3b3ae]',
}
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  reason,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: IconName; reason?: string }) {
  const sz = size === 'sm' ? 'h-9 px-3 text-[13px]' : size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm'
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        {...p}
        title={p.disabled && reason ? reason : p.title}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ${sz} ${VAR[variant]} ${className}`}
      >
        {icon && <Icon name={icon} />}
        {children}
      </button>
      {p.disabled && reason && (
        <span className="flex max-w-xs items-start gap-1 text-xs text-danger" role="note">
          <Icon name="info" className="mt-0.5 size-3.5" />
          {reason}
        </span>
      )}
    </span>
  )
}

export function Card({ children, className = '', pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={`rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(70,55,33,.05)] ${pad ? 'p-5' : ''} ${className}`}>{children}</section>
}

export function PageHeader({ title, desc, actions, crumbs }: { title: string; desc?: ReactNode; actions?: ReactNode; crumbs?: { label: string; to?: string }[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-[13px] text-cocoa-soft">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <Icon name="chevron" className="size-3" />}
                {c.to ? <Link to={c.to} className="hover:underline">{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[28px] leading-tight">{title}</h1>
        {desc && <p className="mt-1 max-w-3xl text-sm text-cocoa-soft">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, aria: Record<string, string | boolean | undefined>) => ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold">{label}</label>
      {children(id, { 'aria-invalid': !!error, 'aria-describedby': error ? id + '-e' : hint ? id + '-h' : undefined })}
      {error ? (
        <p id={id + '-e'} className="mt-1 flex items-center gap-1 text-xs text-danger"><Icon name="alert" className="size-3.5" />{error}</p>
      ) : hint ? (
        <p id={id + '-h'} className="mt-1 text-xs text-cocoa-soft">{hint}</p>
      ) : null}
    </div>
  )
}
export const inputCls = 'h-10 w-full rounded-xl border border-line bg-white px-3 text-sm placeholder:text-[#a79b88] read-only:bg-ivory read-only:text-cocoa-soft focus:border-forest aria-[invalid=true]:border-danger'

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`animate-pop flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 hover:bg-cream"><Icon name="x" className="size-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onClose, danger }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => { onClose(); onConfirm() }}>{confirmLabel}</Button></>}>
      <div className="text-sm text-cocoa-soft">{children}</div>
    </Modal>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${value === t.id ? 'border-forest text-forest' : 'border-transparent text-cocoa-soft hover:text-cocoa'}`}>
          {t.icon && <Icon name={t.icon} />}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`animate-rise pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${t.kind === 'error' ? 'border-danger/30 bg-danger-soft text-danger' : t.kind === 'info' ? 'border-line bg-white' : 'border-forest/25 bg-sage text-forest-dark'}`}>
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} className="mt-0.5" />
          <span className="flex-1 font-medium">{t.msg}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Đóng thông báo"><Icon name="x" className="size-4" /></button>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, desc, action, icon = 'box' }: { title: string; desc?: string; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-sage text-forest"><Icon name={icon} className="size-6" /></span>
      <h3 className="text-base">{title}</h3>
      {desc && <p className="mt-1 max-w-md text-sm text-cocoa-soft">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-cocoa-soft">
      <span className="animate-spin-slow size-5 rounded-full border-2 border-sage border-t-forest" />
      {label}
    </div>
  )
}
export function ErrorState({ title, desc, action, tone = 'error' }: { title: string; desc?: ReactNode; action?: ReactNode; tone?: 'error' | 'warn' }) {
  return (
    <div role="alert" className={`flex flex-col items-center rounded-2xl border px-6 py-10 text-center ${tone === 'error' ? 'border-danger/25 bg-danger-soft' : 'border-harvest/50 bg-cream'}`}>
      <span className={`mb-3 grid size-12 place-items-center rounded-full bg-white ${tone === 'error' ? 'text-danger' : 'text-harvest-dark'}`}><Icon name="alert" className="size-6" /></span>
      <h3 className="text-base">{title}</h3>
      {desc && <p className="mt-1 max-w-lg text-sm text-cocoa-soft">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'danger' | 'success'; children: ReactNode; title?: string }) {
  const c = { info: 'border-line bg-cream', warn: 'border-harvest/60 bg-cream', danger: 'border-danger/30 bg-danger-soft', success: 'border-forest/30 bg-sage/60' }[tone]
  const ic: IconName = tone === 'danger' ? 'alert' : tone === 'success' ? 'check' : tone === 'warn' ? 'warn' : 'info'
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${c}`}>
      <Icon name={ic} className="mt-0.5 size-5" />
      <div>{title && <p className="font-semibold">{title}</p>}<div className="text-cocoa-soft">{children}</div></div>
    </div>
  )
}

export function Copy({ text, label }: { text: string; label?: string }) {
  const { toast } = useStore()
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {})
        setDone(true)
        toast('Đã sao chép', 'info')
        setTimeout(() => setDone(false), 1500)
      }}
      aria-label={label ?? 'Sao chép'}
      className="rounded-md p-1 text-cocoa-soft hover:bg-sage/60 hover:text-forest"
    >
      <Icon name={done ? 'check' : 'copy'} className="size-3.5" />
    </button>
  )
}

export function KPI({ label, value, hint, icon, tone = 'green' }: { label: string; value: ReactNode; hint?: string; icon: IconName; tone?: 'green' | 'orange' | 'red' | 'brown' }) {
  const t = { green: 'bg-sage text-forest', orange: 'bg-cream text-harvest-dark', red: 'bg-danger-soft text-danger', brown: 'bg-ivory text-cocoa' }[tone]
  return (
    <Card className="flex items-start gap-4">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${t}`}><Icon name={icon} className="size-5" /></span>
      <div>
        <p className="text-[13px] text-cocoa-soft">{label}</p>
        <p className="text-[28px] font-bold leading-tight">{value}</p>
        {hint && <p className="text-xs text-cocoa-soft">{hint}</p>}
      </div>
    </Card>
  )
}

export const SimTag = ({ className = '' }: { className?: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border border-harvest/60 bg-cream px-2 py-0.5 text-[11px] font-semibold text-harvest-dark ${className}`}>
    <Icon name="info" className="size-3" />
    Dữ liệu mô phỏng
  </span>
)

export function Table({ head, children, className = '' }: { head: string[]; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[640px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-[12px] uppercase tracking-wide text-cocoa-soft">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}
