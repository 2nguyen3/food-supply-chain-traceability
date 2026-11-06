import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../../app/session'
import { Button } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { WalletChip } from '../../components/common'
import { getDemoWallet } from './demoWallets'
import './styles/connect.css'
import './styles/noaccess.css'

const STEPS = ['Kết nối ví', 'Mạng Sepolia', 'Ký challenge', 'Đọc role']
const ACTIVE_STEPS = 4

function LockIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4.5"
        y="10"
        width="15"
        height="10.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 14v2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function NoAccessPage() {
  const { session, setProductionSession } = useSession()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const wallet = session?.wallet ?? getDemoWallet(params.get('w'))

  if (!wallet) return <Navigate to="/connect" replace />

  function handleLogout() {
    setProductionSession(null)
    showToast('Đã đăng xuất')
    navigate('/connect')
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

        <section className="noaccess-card" aria-labelledby="noaccess-title">
          <span className="noaccess-icon">
            <LockIcon />
          </span>
          <h1 className="noaccess-title" id="noaccess-title">
            Ví chưa được cấp quyền
          </h1>

          <div className="noaccess-wallet">
            <WalletChip wallet={wallet} label="Ví chưa cấp quyền" />
          </div>

          <p className="noaccess-description">
            hasRole trả về không cho Admin, Farmer, Logistics hay Retailer. Role không thể tự đăng
            ký. Hãy liên hệ Admin của COCOMARK (ngoài hệ thống) để được cấp role cho địa chỉ ví này.
          </p>

          <div className="noaccess-actions">
            <Button type="button" className="noaccess-primary" onClick={handleLogout}>
              <LogoutIcon />
              Đăng xuất / đổi ví
            </Button>
            <Link className="button secondary noaccess-secondary" to="/trace">
              Tra cứu công khai
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
