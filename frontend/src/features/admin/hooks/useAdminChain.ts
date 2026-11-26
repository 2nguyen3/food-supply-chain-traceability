import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../../../app/session'
import { AdminChainError } from '../services/adminChain'

export type AdminQueryState<T> =
  { kind: 'loading' } | { kind: 'ready'; data: T } | { kind: 'error'; message: string }

/**
 * Tải dữ liệu Admin từ chain cho phiên đang đăng nhập.
 * `loader` phải ổn định (useCallback); đổi ví hoặc gọi `reload()` thì đọc lại.
 */
export function useAdminChain<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const { session } = useSession()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AdminQueryState<T>>({ kind: 'loading' })

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    loader(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ kind: 'ready', data })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          kind: 'error',
          message:
            error instanceof AdminChainError
              ? error.message
              : 'Không đọc được dữ liệu từ blockchain. Kiểm tra kết nối và thử lại.',
        })
      },
    )
    return () => controller.abort()
  }, [loader, attempt, session?.wallet.address])

  return { state, reload }
}
