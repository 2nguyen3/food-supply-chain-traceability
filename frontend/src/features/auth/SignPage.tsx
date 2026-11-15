import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useSession } from '../../app/session'
import { Button } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { config, networkName } from '../../config/env'
import {
  describeAuthError,
  requestChallenge,
  verifyLogin,
  type Challenge,
} from '../../services/authApi'
import { HttpError } from '../../services/http'
import { readRoles, RolesError } from '../../services/roles'
import {
  currentAccount,
  disconnectWallet,
  signLoginMessage,
  toWalletError,
} from '../../services/wallet'
import { LOGIN_STEPS, ROLE_HOME } from './steps'
import './styles/connect.css'
import './styles/sign.css'

const STEPS = LOGIN_STEPS
const ACTIVE_STEPS = 3

type SignStage =
  | 'idle'
  | 'signing'
  | 'verifying'
  | 'reading'
  | 'rejected'
  | 'failed'
  | 'rolesFailed'
  | 'success'

type ChallengeState =
  | { status: 'loading' }
  | { status: 'ready'; challenge: Challenge }
  | { status: 'error'; message: string }

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
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
  const { session, pending, setPending, setProductionSession } = useSession()
  const { showToast, clearToasts } = useToast()
  const navigate = useNavigate()
  const [challenge, setChallenge] = useState<ChallengeState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [copied, setCopied] = useState(false)
  const [stage, setStage] = useState<SignStage>('idle')
  const [failure, setFailure] = useState('')
  const expiresAtRef = useRef(0)

  const address = pending?.address
  const wrongChain = pending !== null && pending.chainId !== config.chainId

  // Lấy thông điệp từ backend cho đúng ví đang kết nối (đổi ví hoặc thử lại thì lấy lại)
  useEffect(() => {
    if (!address || wrongChain) return
    const controller = new AbortController()
    setChallenge({ status: 'loading' })
    requestChallenge(address, controller.signal)
      .then((data) => {
        if (data.chain_id !== config.chainId)
          setChallenge({
            status: 'error',
            message: `Máy chủ đang dùng chainId ${data.chain_id} nhưng giao diện cấu hình chainId ${config.chainId}.`,
          })
        else setChallenge({ status: 'ready', challenge: data })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setChallenge({ status: 'error', message: describeAuthError(error) })
      })
    return () => controller.abort()
  }, [address, wrongChain, attempt])

  // Ký xong và đã đọc vai trò thì chuyển trang
  useEffect(() => {
    if (stage !== 'success') return
    const role = session?.wallet.roles[0]
    const timer = window.setTimeout(() => {
      navigate(role ? ROLE_HOME[role] : '/auth/no-access', { replace: true })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [stage, session, navigate])

  if (session && stage !== 'success') {
    const role = session.wallet.roles[0]
    return <Navigate to={role ? ROLE_HOME[role] : '/auth/no-access'} replace />
  }
  if (!pending && stage !== 'success') return <Navigate to="/connect" replace />
  if (wrongChain) return <Navigate to="/auth/network" replace />

  const walletAddress = pending?.address ?? session?.wallet.address ?? ''
  const busy = stage === 'signing' || stage === 'verifying' || stage === 'reading'
  const ready = challenge.status === 'ready'
  const lines = ready ? challenge.challenge.message.split('\n') : []

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      showToast('Đã sao chép địa chỉ ví', 'success')
    } catch {
      showToast('Không thể sao chép địa chỉ ví trên trình duyệt này', 'error')
    }
  }

  /** Sau khi backend xác thực: đọc vai trò từ hợp đồng rồi mở phiên. */
  async function finishLogin() {
    if (!pending) return
    setStage('reading')
    try {
      const roles = await readRoles(pending.address)
      setProductionSession({
        source: 'chain',
        wallet: { address: pending.address, chainId: pending.chainId, roles },
        expiresAt: expiresAtRef.current,
      })
      setPending(null)
      setStage('success')
    } catch (error) {
      setFailure(error instanceof RolesError ? error.message : 'Không đọc được vai trò.')
      setStage('rolesFailed')
    }
  }

  async function handleSign() {
    if (!ready || !pending || busy || stage === 'success') return
    clearToasts()
    setFailure('')
    const { nonce, message } = challenge.challenge

    // Tài khoản đang chọn trong ví phải đúng là ví đã kết nối
    const active = await currentAccount()
    if (active && active.toLowerCase() !== pending.address.toLowerCase()) {
      setPending({ ...pending, address: active })
      return
    }

    setStage('signing')
    let signature: string
    try {
      signature = await signLoginMessage(pending.address, message)
    } catch (error) {
      const wallet = toWalletError(error)
      if (wallet.code === 'REJECTED') {
        setStage('rejected')
      } else {
        setFailure(wallet.message)
        setStage('failed')
      }
      return
    }

    setStage('verifying')
    try {
      const result = await verifyLogin(pending.address, nonce, signature)
      expiresAtRef.current = result.expiresAt
    } catch (error) {
      setFailure(describeAuthError(error))
      setStage('failed')
      // nonce chỉ dùng một lần và hết hạn sau 5 phút: lấy thông điệp mới
      if (error instanceof HttpError && error.code === 'NONCE_INVALID') setAttempt((n) => n + 1)
      return
    }
    await finishLogin()
  }

  const stageNotice: Partial<Record<SignStage, string>> = {
    signing: 'Hãy xác nhận chữ ký trong cửa sổ MetaMask.',
    verifying: 'Đang xác thực chữ ký với máy chủ...',
    reading: 'Đang đọc vai trò từ hợp đồng...',
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
              <strong>Ví đã kết nối</strong>
              <span className="sign-address">{shortAddress(walletAddress)}</span>
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
              {networkName} · {config.chainId}
            </div>
          </div>

          <p className="sign-description">
            Ví chỉ ký một thông điệp chứa nonce, domain, chainId và thời hạn. Ký không tốn phí và
            không cấp quyền chuyển tài sản. Phiên truy cập tài liệu riêng kéo dài 20 phút.
          </p>

          <div className="sign-message" aria-label="Nội dung thông điệp cần ký">
            {challenge.status === 'loading' && <div>Đang lấy thông điệp từ máy chủ...</div>}
            {challenge.status === 'error' && <div>{challenge.message}</div>}
            {lines.map((line, index) => (
              <div key={index}>{line || '\u00a0'}</div>
            ))}
          </div>

          {challenge.status === 'error' && (
            <div className="sign-result rejected" role="alert">
              <span className="sign-result-icon">
                <AlertIcon />
              </span>
              <strong>Chưa lấy được thông điệp đăng nhập</strong>
              <p>{challenge.message}</p>
            </div>
          )}

          {stage === 'rejected' && (
            <div className="sign-result rejected" role="alert">
              <span className="sign-result-icon">
                <AlertIcon />
              </span>
              <strong>Bạn đã từ chối chữ ký</strong>
              <p>Không có phiên nào được tạo. Hãy thử lại khi sẵn sàng.</p>
            </div>
          )}

          {(stage === 'failed' || stage === 'rolesFailed') && (
            <div className="sign-result rejected" role="alert">
              <span className="sign-result-icon">
                <AlertIcon />
              </span>
              <strong>
                {stage === 'rolesFailed' ? 'Đã ký nhưng chưa đọc được vai trò' : 'Đăng nhập chưa thành công'}
              </strong>
              <p>{failure}</p>
            </div>
          )}

          {busy && (
            <p className="sign-description" role="status">
              {stageNotice[stage]}
            </p>
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
            {challenge.status === 'error' ? (
              <Button
                type="button"
                className="sign-primary"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Thử lại
              </Button>
            ) : stage === 'rolesFailed' ? (
              <Button type="button" className="sign-primary" onClick={finishLogin}>
                Đọc lại vai trò
              </Button>
            ) : (
              <Button
                type="button"
                className="sign-primary"
                onClick={handleSign}
                disabled={!ready || busy || stage === 'success'}
              >
                <PenIcon />
                {stage === 'rejected' || stage === 'failed' ? 'Ký lại' : 'Ký thông điệp'}
              </Button>
            )}
            <Link className="sign-switch" to="/connect" onClick={() => {
                setPending(null)
                void disconnectWallet()
              }}>
              Đổi ví
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
