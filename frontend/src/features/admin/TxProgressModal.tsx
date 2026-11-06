import { useEffect, useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { useToast } from '../../components/ui/toast'

const TX_PROGRESS_STEPS = [
  {
    title: 'Kiểm tra điều kiện',
    description: 'Đối chiếu vai trò, chủ sở hữu, vòng đời và quy tắc nghiệp vụ.',
  },
  {
    title: 'Chờ ký ví',
    description: 'Xác nhận chữ ký trong MetaMask.',
  },
  {
    title: 'Phát giao dịch',
    description: 'Giao dịch đã được gửi đi.',
  },
  {
    title: 'Chờ biên nhận',
    description: 'Đang chờ xác nhận giao dịch.',
  },
  {
    title: 'Xác nhận',
    description: 'Trạng thái thay đổi sau biên nhận.',
  },
]

interface SummaryItem {
  label: string
  value: string
}

interface TxProgressModalProps {
  open: boolean
  onClose: () => void
  title: string
  className?: string
  method: string
  summary: SummaryItem[]
  txHash: string
  onFinish: () => void
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function TxProgressModal({
  open,
  onClose,
  title,
  className = '',
  method,
  summary,
  txHash,
  onFinish,
}: TxProgressModalProps) {
  const { showToast } = useToast()
  const [completed, setCompleted] = useState(0)

  useEffect(() => {
    if (!open) {
      setCompleted(0)
      return
    }
    setCompleted(1)
  }, [open])

  useEffect(() => {
    if (!open || completed < 1 || completed >= TX_PROGRESS_STEPS.length) return
    const timer = window.setTimeout(() => setCompleted((current) => current + 1), 900)
    return () => window.clearTimeout(timer)
  }, [open, completed])

  const done = completed >= TX_PROGRESS_STEPS.length

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className={`roles-modal roles-modal-progress ${className}`}
      footer={
        done ? (
          <Button onClick={onFinish}>
            <CheckIcon />
            Hoàn tất
          </Button>
        ) : (
          <span className="roles-progress-note">Đang chờ xác nhận giao dịch...</span>
        )
      }
    >
      <span className="roles-modal-chip">{method}</span>

      <div className="roles-summary">
        {summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <ol className="roles-steps">
        {TX_PROGRESS_STEPS.map((step, index) => {
          const position = index + 1
          const isDone = position <= completed
          const active = position === completed + 1
          return (
            <li
              key={step.title}
              className={`roles-step ${isDone ? 'done' : active ? 'active' : 'pending'}`}
            >
              <span className="roles-step-icon">
                {isDone ? <CheckIcon /> : active ? <span className="roles-spinner" /> : null}
              </span>
              <span className="roles-step-text">
                <strong>{step.title}</strong>
                <span>{step.description}</span>
                {position === 3 && isDone && (
                  <span className="roles-tx">
                    <span className="mono">{shortHash(txHash)}</span>
                    <button
                      type="button"
                      onClick={() => copyText(txHash, 'Đã sao chép mã giao dịch')}
                      aria-label="Sao chép mã giao dịch"
                      title="Sao chép mã giao dịch"
                    >
                      <CopyIcon />
                    </button>
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>

      {done && <div className="roles-success">Giao dịch đã được xác nhận.</div>}
    </Modal>
  )
}
