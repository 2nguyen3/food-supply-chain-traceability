import { useCallback, useState } from 'react'

export type FlowPhase = 'idle' | 'running' | 'success' | 'failed'

export interface StepFlowState {
  phase: FlowPhase
  /** Bước đang chạy (chỉ số trong danh sách bước). */
  index: number
  error: string
  /** Lỗi do người dùng từ chối ký, không phải sự cố. */
  rejected: boolean
  txHash: string
}

const INITIAL: StepFlowState = { phase: 'idle', index: 0, error: '', rejected: false, txHash: '' }

/** Trạng thái của một chuỗi bước nhiều giai đoạn (kiểm tra, ký, phát, chờ biên nhận, ...). */
export function useStepFlow() {
  const [state, setState] = useState<StepFlowState>(INITIAL)
  const start = useCallback(() => setState({ ...INITIAL, phase: 'running' }), [])
  const goTo = useCallback((index: number) => setState((s) => ({ ...s, index })), [])
  const setTxHash = useCallback((txHash: string) => setState((s) => ({ ...s, txHash })), [])
  const succeed = useCallback(() => setState((s) => ({ ...s, phase: 'success' })), [])
  const fail = useCallback(
    (error: string, rejected = false) => setState((s) => ({ ...s, phase: 'failed', error, rejected })),
    [],
  )
  const reset = useCallback(() => setState(INITIAL), [])
  return { state, start, goTo, setTxHash, succeed, fail, reset }
}
