/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void
  clearToasts: () => void
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  clearToasts: () => {},
})

let nextToastId = 1

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 10.5v6M12 7.5h.01"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m8 12 2.7 2.7L16 9.3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AlertCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 16.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') return <CheckCircleIcon />
  if (tone === 'error') return <AlertCircleIcon />
  return <InfoIcon />
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer))
    },
    [],
  )

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const clearToasts = useCallback(() => setToasts([]), [])

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextToastId++
      setToasts((current) => [...current.slice(-2), { id, message, tone }])
      timers.current.push(window.setTimeout(() => dismiss(id), 5200))
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast, clearToasts }}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`} role="status">
            <span className="toast-icon">
              <ToastIcon tone={toast.tone} />
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Đóng thông báo"
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
