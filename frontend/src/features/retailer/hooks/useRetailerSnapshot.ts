import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../../../app/session'
import { readRetailerSnapshot, type RetailerSnapshot } from '../services/retailerChain'

export function useRetailerSnapshot() {
  const { session } = useSession()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; data?: RetailerSnapshot; error?: string } | null>(null)
  const address = session?.source === 'chain' ? session.wallet.address : undefined
  const key = `${address ?? 'preview'}:${attempt}`
  useEffect(() => {
    if (!address) return
    const controller = new AbortController()
    readRetailerSnapshot(address, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ key, data }) },
      (error: unknown) => { if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Không đọc được dữ liệu.' }) },
    )
    return () => controller.abort()
  }, [address, key])
  return {
    address,
    data: state?.key === key ? state.data : undefined,
    error: address ? (state?.key === key ? state.error : undefined) : 'Hãy đăng nhập bằng ví Retailer để đọc dữ liệu thật.',
    loading: !!address && state?.key !== key,
    reload: useCallback(() => setAttempt((value) => value + 1), []),
  }
}
