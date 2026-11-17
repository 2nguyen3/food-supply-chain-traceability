import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useSession } from '../../app/session'
import { Button } from '../../components/ui'
import { config, networkName } from '../../config/env'
import { switchToConfiguredChain, toWalletError } from '../../services/wallet'
import { LOGIN_STEPS, ROLE_HOME } from './steps'
import './styles/connect.css'
import './styles/network.css'

const STEPS = LOGIN_STEPS
const ACTIVE_STEPS = 2

type SwitchStage = 'idle' | 'switching' | 'failed'

function AlertIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function SwitchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9a8 8 0 0 1 13.5-3.5L20 8M20 15a8 8 0 0 1-13.5 3.5L4 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 4v4h-4M4 20v-4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function NetworkPage() {
  const { session, pending, setPending } = useSession()
  const navigate = useNavigate()
  const [stage, setStage] = useState<SwitchStage>('idle')
  const [failure, setFailure] = useState('')

  // Đang chờ ký (pending) hoặc đã đăng nhập nhưng ví vừa đổi sang mạng khác (session)
  const wallet = pending ?? session?.wallet
  const onRightChain = wallet?.chainId === config.chainId

  useEffect(() => {
    if (!wallet || !onRightChain) return
    if (pending) navigate('/auth/sign', { replace: true })
    else {
      const role = session?.wallet.roles[0]
      navigate(role ? ROLE_HOME[role] : '/auth/no-access', { replace: true })
    }
  }, [wallet, onRightChain, pending, session, navigate])

  if (!wallet) return <Navigate to="/connect" replace />

  async function handleSwitch() {
    setStage('switching')
    setFailure('')
    try {
      await switchToConfiguredChain()
      // trạng thái mạng mới được cập nhật qua sự kiện chainChanged của ví
      if (pending) setPending({ ...pending, chainId: config.chainId })
    } catch (cause) {
      setFailure(toWalletError(cause).message)
      setStage('failed')
      return
    }
    setStage('idle')
  }

  const switching = stage === 'switching'

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

        <section className="network-card" aria-labelledby="network-title">
          <span className="network-icon">
            <AlertIcon />
          </span>
          <h1 className="network-title" id="network-title">
            Sai mạng blockchain
          </h1>
          <p className="network-description">
            COCOMARK yêu cầu mạng <strong>{networkName}</strong> (chainId {config.chainId}). Ví của
            bạn đang ở chainId {wallet.chainId}. Hãy chuyển mạng trong MetaMask rồi thử lại.
          </p>

          {stage === 'failed' && (
            <div className="network-failure" role="alert">
              <span className="network-failure-icon">
                <AlertIcon />
              </span>
              <strong>Chuyển mạng thất bại</strong>
              <p>{failure}</p>
            </div>
          )}

          <div className="network-actions">
            <Button
              type="button"
              className={`network-primary${stage === 'failed' ? ' network-primary-compact' : ''}`}
              onClick={handleSwitch}
              disabled={switching}
            >
              <SwitchIcon />
              {switching
                ? 'Đang chuyển mạng...'
                : stage === 'failed'
                  ? 'Thử lại'
                  : `Chuyển sang ${networkName}`}
            </Button>
            <Link className="button secondary network-secondary" to="/">
              Về trang chủ
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
