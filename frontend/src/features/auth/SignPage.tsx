import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../../app/session'
import { Button } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import type { Role } from '../../domain/types'
import { getDemoWallet } from './demoWallets'
import './styles/connect.css'
import './styles/sign.css'

const STEPS = ['Kết nối ví', 'Mạng Sepolia', 'Ký challenge', 'Đọc role']
const ACTIVE_STEPS = 3

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  farmer: 'Farmer',
  logistics: 'Logistics',
  retailer: 'Retailer',
}

const ROLE_HOME: Record<Role, string> = {
  admin: '/admin/overview',
  farmer: '/farmer/overview',
  logistics: '/logistics/overview',
  retailer: '/retailer/overview',
}

type SignStage = 'idle' | 'rejected' | 'success'

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(
    date.getMonth() + 1,
  )}/${date.getFullYear()}`
}

function makeChallenge() {
  const issuedAt = new Date()
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return {
    nonce: Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
    domain: window.location.host,
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 20 * 60 * 1000),
  }
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 9.5h18M16.5 14.5h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12 5 5L20 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SuccessCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m4.5 12.5 5 5L20 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 2.8 20h18.4L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9v5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 17.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SignPage() {
  const { session, setProductionSession } = useSession()
  const { showToast, clearToasts } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [challenge, setChallenge] = useState(makeChallenge)
  const [copied, setCopied] = useState(false)

  const previewStage = import.meta.env.DEV ? params.get('state') : null
  const [stage, setStage] = useState<SignStage>(
    previewStage === 'rejected' ? 'rejected' : previewStage === 'success' ? 'success' : 'idle',
  )
  const [armed, setArmed] = useState(false)
  const holdSuccess = import.meta.env.DEV && params.get('hold') === '1'

  const demoKey = params.get('w')
  const fallback = getDemoWallet(demoKey)
  const wallet = session?.wallet ?? fallback
  const role = wallet?.roles[0]

  useEffect(() => {
    if (stage !== 'success' || holdSuccess) return
    const timer = window.setTimeout(() => {
      navigate(role ? ROLE_HOME[role] : '/auth/no-access', { replace: true })
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [stage, holdSuccess, role, navigate])

  if (!wallet) return <Navigate to="/connect" replace />

  const activeWallet = wallet
  const roleLabel = role ? ROLE_LABELS[role] : 'Ví chưa cấp quyền'
  const message = [
    'COCOMARK đăng nhập',
    'Mục đích: xác thực phiên',
    `Domain: ${challenge.domain}`,
    `Địa chỉ: ${activeWallet.address}`,
    `ChainId: ${activeWallet.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `IssuedAt: ${formatDateTime(challenge.issuedAt)}`,
    `ExpirationTime: ${formatDateTime(challenge.expiresAt)}`,
  ]

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(activeWallet.address)
      setCopied(true)
      showToast('Đã sao chép địa chỉ ví', 'success')
    } catch {
      showToast('Không thể sao chép địa chỉ ví trên trình duyệt này', 'error')
    }
  }

  function completeSign() {
    setProductionSession({
      source: session?.source ?? (fallback ? 'development-preview' : 'chain'),
      wallet: activeWallet,
    })
    setStage('success')
  }

  function handleSign() {
    if (stage === 'success') return
    if (armed) {
      clearToasts()
      setStage('rejected')
      return
    }
    clearToasts()
    completeSign()
  }

  function handleReject() {
    clearToasts()
    setArmed(true)
    showToast('Lần ký kế tiếp sẽ bị từ chối')
  }

  function handleRetry() {
    clearToasts()
    setArmed(false)
    setChallenge(makeChallenge())
    completeSign()
  }

  function handleSwitchWallet() {
    setProductionSession(null)
    showToast('Đã đăng xuất')
  }

  return (
    <div className="connect-page">
      <div className="connect-inner">
        <ol className="connect-stepper" aria-label="Các bước đăng nhập bằng ví">
          {STEPS.map((step, index) => {
            const active = index < ACTIVE_STEPS
            return (
              <li
                key={step}
                className={`connect-step${active ? ' active' : ''}`}
                aria-current={index === ACTIVE_STEPS - 1 ? 'step' : undefined}
              >
                <span className="connect-step-number">{index + 1}</span>
                <span>{step}</span>
              </li>
            )
          })}
        </ol>

        <section className="sign-card" aria-labelledby="sign-title">
          <h1 className="sign-title" id="sign-title">
            Ký challenge để đăng nhập
          </h1>

          <div className="sign-meta">
            <div className="sign-wallet">
              <WalletIcon />
              <strong>{roleLabel}</strong>
              <span className="sign-address">{shortAddress(activeWallet.address)}</span>
              <button
                type="button"
                className="sign-copy"
                onClick={copyAddress}
                aria-label="Sao chép địa chỉ ví"
                title="Sao chép địa chỉ ví"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>

            <div className="sign-network">
              <span className="sign-network-dot" aria-hidden="true" />
              Sepolia testnet · {activeWallet.chainId}
            </div>
          </div>

          <p className="sign-description">
            Ví chỉ ký một thông điệp chứa nonce, domain, chainId và thời hạn. Ký không tốn phí và
            không cấp quyền chuyển tài sản. Phiên truy cập tài liệu riêng kéo dài 20 phút.
          </p>

          <div className="sign-message" aria-label="Nội dung thông điệp cần ký">
            {message.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>

          {stage === 'rejected' && (
            <div className="sign-result rejected" role="alert">
              <span className="sign-result-icon">
                <AlertIcon />
              </span>
              <strong>Bạn đã từ chối chữ ký</strong>
              <p>Không có phiên nào được tạo. Hãy thử lại khi sẵn sàng.</p>
            </div>
          )}

          {stage === 'success' && (
            <div className="sign-result success" role="status">
              <span className="sign-result-icon">
                <SuccessCheckIcon />
              </span>
              <span className="sign-result-text">
                <strong>Đã ký thành công</strong>
                <span>Đang kiểm tra quyền truy cập...</span>
              </span>
            </div>
          )}

          <div className="sign-actions">
            {stage === 'rejected' ? (
              <Button type="button" className="sign-primary" onClick={handleRetry}>
                <PenIcon />
                Ký lại
              </Button>
            ) : (
              <Button
                type="button"
                className="sign-primary"
                onClick={handleSign}
                disabled={stage === 'success'}
              >
                <PenIcon />
                Ký thông điệp
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="sign-secondary"
              onClick={handleReject}
            >
              Mô phỏng từ chối
            </Button>
            <Link className="sign-switch" to="/connect" onClick={handleSwitchWallet}>
              Đổi ví
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
