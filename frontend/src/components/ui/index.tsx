import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return (
    <button className={`button ${variant === 'primary' ? '' : variant} ${className}`} {...props} />
  )
}
type FieldProps = { label: string; hint?: string; error?: string }
export function Input({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${fieldId}-error`} className="field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${fieldId}-hint`} className="muted">
          {hint}
        </span>
      ) : null}
    </div>
  )
}
export function Textarea({
  label,
  hint,
  error,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      />
      {error ? (
        <span id={`${fieldId}-error`} className="field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${fieldId}-hint`} className="muted">
          {hint}
        </span>
      ) : null}
    </div>
  )
}
export function Select({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <select
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span id={`${fieldId}-error`} className="field-error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${fieldId}-hint`} className="muted">
          {hint}
        </span>
      ) : null}
    </div>
  )
}
export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props} />
}
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  className = '',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        )
        if (!items.length) {
          event.preventDefault()
          return
        }
        const first = items[0],
          last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [open])
  if (!open) return null
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`modal ${wide ? 'wide' : ''} ${className}`.trim()}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <Button variant="secondary" onClick={onClose} aria-label="Đóng">
            ×
          </Button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Xác nhận',
  danger = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  empty = 'Chưa có dữ liệu.',
}: {
  columns: { key: string; label: string; render: (row: T) => ReactNode }[]
  rows: T[]
  keyOf: (row: T) => string
  empty?: string
}) {
  if (!rows.length) return <EmptyState title={empty} />
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyOf(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  return <span className={`badge ${tone === 'success' ? '' : tone}`}>{children}</span>
}
export const StatusBadge = Badge
export function Toast({
  message,
  onClose,
  tone = 'neutral',
}: {
  message: string
  onClose: () => void
  tone?: 'success' | 'warning' | 'danger' | 'neutral'
}) {
  return (
    <div className="toast-region" role="status">
      <div className="toast">
        <Badge tone={tone}>{message}</Badge>{' '}
        <button onClick={onClose} aria-label="Đóng thông báo">
          ×
        </button>
      </div>
    </div>
  )
}
export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Đường dẫn" className="breadcrumb">
      {items.map((item, index) => (
        <span key={index}>
          {index > 0 && ' / '}
          {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
        </span>
      ))}
    </nav>
  )
}
export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: string
  description?: string
  actions?: ReactNode
  crumbs?: { label: string; to?: string }[]
}) {
  return (
    <div className="page-header">
      <div>
        {crumbs && <Breadcrumb items={crumbs} />}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
export function LoadingState({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      {label}
    </div>
  )
}
export function EmptyState({
  title = 'Chưa có dữ liệu',
  description,
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  )
}
export function ErrorState({
  title = 'Không thể tải dữ liệu',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="state error" role="alert">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
