import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../../app/session'
import { Button } from '../../components/ui'
import { getDemoWallet } from './demoWallets'
import './styles/connect.css'
import './styles/network.css'

const STEPS = ['Kết nối ví', 'Mạng Sepolia', 'Ký challenge', 'Đọc role']
const ACTIVE_STEPS = 2
const SEPOLIA_CHAIN_ID = 11155111

type SwitchStage = 'idle' | 'failed' | 'switching'

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
  const { session, setProductionSession } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [stage, setStage] = useState<SwitchStage>('idle')

  const demoKey = params.get('w')
  const wallet = session?.wallet ?? getDemoWallet(demoKey)

  useEffect(() => {
    if (stage !== 'switching') return
    const timer = window.setTimeout(() => {
      navigate(demoKey ? `/auth/sign?w=${demoKey}` : '/auth/sign', { replace: true })
    }, 1400)
    return () => window.clearTimeout(timer)
  }, [stage, demoKey, navigate])

  function handleSwitch() {
    setStage('failed')
  }

  function handleRetry() {
    if (wallet) {
      setProductionSession({
        source: session?.source ?? (demoKey ? 'development-preview' : 'chain'),
        wallet: { ...wallet, chainId: SEPOLIA_CHAIN_ID },
      })
    }
    setStage('switching')
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
            COCOMARK yêu cầu mạng Ethereum <strong>Sepolia</strong> (chainId 11155111). Ví của bạn
            đang ở mạng khác. Hãy chuyển mạng trong MetaMask rồi thử lại. Prototype không tự đổi
            mạng thật.
          </p>

          {stage === 'failed' && (
            <div className="network-failure" role="alert">
              <span className="network-failure-icon">
                <AlertIcon />
              </span>
              <strong>Chuyển mạng thất bại</strong>
              <p>Bạn đã từ chối yêu cầu chuyển mạng. Hãy thử lại.</p>
            </div>
          )}

          <div className="network-actions">
            <Button
              type="button"
              className={`network-primary${stage === 'failed' ? ' network-primary-compact' : ''}`}
              onClick={stage === 'failed' ? handleRetry : handleSwitch}
              disabled={switching}
            >
              <SwitchIcon />
              {switching
                ? 'Đang chuyển mạng...'
                : stage === 'failed'
                  ? 'Thử lại'
                  : 'Chuyển sang Sepolia'}
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
