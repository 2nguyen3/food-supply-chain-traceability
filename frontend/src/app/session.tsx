/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui/toast'
import type { Session } from '../mocks/session'
import { getPreviewSession } from '../mocks/session'
import { tokens } from '../services/api'
import { logoutApi } from '../services/authApi'
import { disconnectWallet, subscribeWallet } from '../services/wallet'

/** Ví đã kết nối nhưng chưa ký đăng nhập: chưa phải phiên, không vào được khu vực quản lý. */
export interface PendingWallet {
  address: `0x${string}`
  chainId: number
}

interface SessionContextValue {
  session: Session | null
  pending: PendingWallet | null
  setPending: (pending: PendingWallet | null) => void
  /** Đặt phiên mới; truyền null để đăng xuất (thu hồi phiên ở backend và xóa token). */
  setProductionSession: (session: Session | null) => void
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  pending: null,
  setPending: () => {},
  setProductionSession: () => {},
})

const PRIVATE_AREA = /^\/(admin|farmer|logistics|retailer)(\/|$)/

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getPreviewSession())
  const [pending, setPending] = useState<PendingWallet | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { showToast } = useToast()

  const sessionRef = useRef(session)
  const pendingRef = useRef(pending)
  const pathRef = useRef(pathname)
  useEffect(() => {
    sessionRef.current = session
    pendingRef.current = pending
    pathRef.current = pathname
  }, [session, pending, pathname])

  const endSession = useCallback(() => {
    // gọi thu hồi trước: request đọc token ngay khi được gọi, sau đó mới xóa
    void logoutApi().catch(() => {})
    tokens.clearToken()
    setSession(null)
  }, [])

  const setProductionSession = useCallback(
    (next: Session | null) => {
      if (next === null) {
        const usedWallet = sessionRef.current?.source === 'chain' || pendingRef.current !== null
        endSession()
        setPending(null)
        if (usedWallet) void disconnectWallet()
      } else {
        setSession(next)
      }
    },
    [endSession],
  )

  // Đổi tài khoản hoặc đổi mạng trong ví
  useEffect(() => {
    return subscribeWallet({
      onAccounts: (accounts) => {
        const next = accounts[0]?.toLowerCase()
        const current = sessionRef.current
        if (current?.source === 'chain' && next !== current.wallet.address.toLowerCase()) {
          endSession()
          showToast('Ví đã thay đổi, vui lòng đăng nhập lại.', 'info')
          if (PRIVATE_AREA.test(pathRef.current)) navigate('/connect')
          return
        }
        const waiting = pendingRef.current
        if (waiting && next !== waiting.address.toLowerCase()) {
          if (!next) {
            setPending(null)
            navigate('/connect')
          } else {
            setPending({ ...waiting, address: accounts[0] as `0x${string}` })
          }
        }
      },
      onChain: (chainId) => {
        setSession((prev) =>
          prev?.source === 'chain' ? { ...prev, wallet: { ...prev.wallet, chainId } } : prev,
        )
        setPending((prev) => (prev ? { ...prev, chainId } : prev))
      },
    })
  }, [endSession, navigate, showToast])

  // Phiên hết hạn thì đăng nhập lại
  const expiresAt = session?.expiresAt
  useEffect(() => {
    if (!expiresAt) return
    const timer = window.setTimeout(
      () => {
        endSession()
        showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'info')
        if (PRIVATE_AREA.test(pathRef.current)) navigate('/connect')
      },
      Math.max(0, expiresAt - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [expiresAt, endSession, navigate, showToast])

  // Dev: đổi vai trò xem trước qua sự kiện của mocks/session
  useEffect(() => {
    const update = () => setSession(getPreviewSession())
    window.addEventListener('cocomark:session', update)
    return () => window.removeEventListener('cocomark:session', update)
  }, [])

  const value = useMemo(
    () => ({ session, pending, setPending, setProductionSession }),
    [session, pending, setProductionSession],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  return useContext(SessionContext)
}
