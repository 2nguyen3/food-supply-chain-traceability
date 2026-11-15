import type { ReactNode } from 'react'
import { Button, Modal } from './ui'
import { ExplorerLink } from '../features/public/components/ExplorerLink'
import type { StepFlowState } from '../hooks/useStepFlow'
import './tx-progress.css'

export interface TxStepDef {
  label: string
  description: string
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Khung tiến trình giao dịch dùng chung: các bước, thông tin tóm tắt, txHash và kết quả thật. */
export function TxProgressModal({
  open,
  onClose,
  title,
  method,
  summary,
  steps,
  flow,
  successNote,
  onRetry,
}: {
  open: boolean
  onClose: () => void
  title: string
  method: string
  summary: { label: string; value: ReactNode }[]
  steps: TxStepDef[]
  flow: StepFlowState
  successNote?: ReactNode
  onRetry?: () => void
}) {
  const running = flow.phase === 'running'
  const done = flow.phase === 'success'
  const failed = flow.phase === 'failed'
  return (
    <Modal
      open={open}
      onClose={running ? () => {} : onClose}
      title={title}
      footer={
        done ? (
          <Button type="button" onClick={onClose}>
            Hoàn tất
          </Button>
        ) : failed ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            {onRetry && !flow.rejected && (
              <Button type="button" onClick={onRetry}>
                Thử lại
              </Button>
            )}
            {onRetry && flow.rejected && (
              <Button type="button" onClick={onRetry}>
                Ký lại
              </Button>
            )}
          </>
        ) : (
          <span role="status">{steps[flow.index]?.label ?? 'Đang xử lý'}…</span>
        )
      }
    >
      <div className="tx-body">
        <span className="tx-method mono">{method}</span>
        <dl className="tx-summary">
          {summary.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <ol className="tx-steps">
          {steps.map((step, index) => {
            const complete = done || index < flow.index
            const active = !done && index === flow.index
            const state = complete ? 'complete' : active ? (failed ? 'failed' : 'active') : 'pending'
            return (
              <li key={step.label} className={state}>
                <span className="tx-mark">
                  {complete ? <CheckIcon /> : active ? failed ? '!' : <span className="tx-spinner" /> : index + 1}
                </span>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.description}</small>
                </span>
              </li>
            )
          })}
        </ol>
        {flow.txHash && (
          <p className="tx-hash">
            txHash <ExplorerLink kind="tx" value={flow.txHash} />
          </p>
        )}
        {done && successNote && (
          <div className="tx-success" role="status">
            {successNote}
          </div>
        )}
        {failed && (
          <div className="tx-failure" role="alert">
            <strong>{flow.rejected ? 'Bạn đã từ chối ký' : 'Chưa hoàn tất'}</strong>
            <p>{flow.error}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
