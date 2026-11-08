import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../../../app/session'
import { farmerOverviewReader } from '../services/farmerOverviewService'
import type { FarmerOverviewResult } from '../types'

/** Tải dữ liệu Farmer từ hợp đồng cho ví đang đăng nhập; đổi ví hoặc bấm tải lại thì đọc lại. */
export function useFarmerSnapshot() {
  const { session } = useSession()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; result: FarmerOverviewResult } | null>(null)
  const key = `${session?.wallet.address ?? 'none'}:${session?.source ?? 'none'}:${attempt}`

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    farmerOverviewReader.read(session, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setState({ key, result })
      },
      () => {
        if (!controller.signal.aborted)
          setState({ key, result: { kind: 'error', message: 'Không đọc được dữ liệu.' } })
      },
    )
    return () => controller.abort()
  }, [session, key])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const loading = !!session && state?.key !== key
  return { result: loading ? null : (state?.result ?? null), loading, reload }
}
