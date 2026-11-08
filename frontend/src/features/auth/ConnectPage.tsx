import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useSession } from '../../app/session'
import type { Role } from '../../domain/types'
import './styles/connect.css'

const SEPOLIA_CHAIN_ID = 11155111

interface DemoAccount {
  key: string
  label: string
  address: `0x${string}`
  roles: Role[]
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: 'admin',
    label: 'Admin',
    address: '0xAD00000000000000000000000000000000000001',
    roles: ['admin'],
  },
  {
    key: 'farmer',
    label: 'Farmer A',
    address: '0xFA00000000000000000000000000000000000001',
    roles: ['farmer'],
  },
  {
    key: 'farmer',
    label: 'Farmer B',
    address: '0xFB00000000000000000000000000000000000001',
    roles: ['farmer'],
  },
  {
    key: 'logistics',
    label: 'Logistics',
    address: '0x1000000000000000000000000000000000000001',
    roles: ['logistics'],
  },
  {
    key: 'retailer',
    label: 'Retailer',
    address: '0xBE00000000000000000000000000000000000001',
    roles: ['retailer'],
  },
  {
    key: 'none',
    label: 'Ví chưa cấp quyền',
    address: '0xEE00000000000000000000000000000000000001',
    roles: [],
  },
]

const STEPS = ['Kết nối ví', 'Mạng Sepolia', 'Ký challenge', 'Đọc role']

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

function getEthereum(): EthereumProvider | undefined {
  return (window as Window & { ethereum?: EthereumProvider }).ethereum
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-4)}`
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2.5M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3.5M4 7.5h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 11.5H21v4h-4.5a2 2 0 1 1 0-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.25" cy="13.5" r=".9" fill="currentColor" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ConnectPage() {
  const navigate = useNavigate()
  const { setProductionSession } = useSession()
  const [connecting, setConnecting] = useState(false)
  const [wrongNetwork, setWrongNetwork] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDev = import.meta.env.DEV

  async function handleMetaMask() {
    setError(null)
    const ethereum = getEthereum()
    if (!ethereum) {
      setError(
        'Chưa phát hiện MetaMask. Vui lòng cài extension MetaMask hoặc dùng tài khoản mô phỏng bên dưới.',
      )
      return
    }

    setConnecting(true)
    try {
      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[]
      const address = accounts?.[0]
      if (!address) {
        setError('MetaMask không trả về địa chỉ ví. Vui lòng thử lại.')
        return
      }

      const chainHex = (await ethereum.request({ method: 'eth_chainId' })) as string
      const chainId = Number.parseInt(chainHex, 16)

      setProductionSession({
        source: 'chain',
        wallet: { address: address as `0x${string}`, chainId, roles: [] },
      })

      if (chainId !== SEPOLIA_CHAIN_ID) {
        navigate('/auth/network')
        return
      }
      navigate('/auth/sign')
    } catch (cause) {
      const code = (cause as { code?: number }).code
      setError(
        code === 4001
          ? 'Bạn đã từ chối yêu cầu kết nối trong MetaMask.'
          : 'Không thể kết nối ví. Vui lòng kiểm tra MetaMask và thử lại.',
      )
    } finally {
      setConnecting(false)
    }
  }

  function handleDemoAccount(account: DemoAccount) {
    setError(null)
    const chainId = wrongNetwork ? 1 : SEPOLIA_CHAIN_ID
    setProductionSession({
      source: 'development-preview',
      wallet: { address: account.address, chainId, roles: account.roles },
    })

    if (wrongNetwork) {
      navigate(`/auth/network?w=${account.key}`)
      return
    }
    navigate('/auth/sign')
  }

  return (
    <div className="connect-page">
      <div className="connect-inner">
        <ol className="connect-stepper" aria-label="Các bước đăng nhập bằng ví">
          {STEPS.map((step, index) => {
            const active = index === 0
            return (
              <li
                key={step}
                className={`connect-step${active ? ' active' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                <span className="connect-step-number">{index + 1}</span>
                <span>{step}</span>
              </li>
            )
          })}
        </ol>

        <section className="connect-card" aria-labelledby="connect-title">
          <div className="connect-card-head">
            <img
              className="connect-mascot"
              src="/brand/Primary.svg"
              width="64"
              height="64"
              alt=""
            />
            <h1 className="connect-title" id="connect-title">
              Kết nối MetaMask
            </h1>
            <p className="connect-description">
              Đăng nhập bằng ví. Không có email, mật khẩu hay đăng ký role. Role được đọc từ hợp
              đồng (hasRole).
            </p>
          </div>

          <div className="connect-primary-row">
            <Button
              type="button"
              className="connect-primary"
              onClick={handleMetaMask}
              disabled={connecting}
            >
              <WalletIcon />
              {connecting ? 'Đang kết nối…' : 'Kết nối MetaMask'}
            </Button>
          </div>

          {error && (
            <p className="connect-error" role="alert">
              {error}
            </p>
          )}

          {isDev && (
            <div className="connect-demo">
              <h2 className="connect-section-title">Chọn tài khoản</h2>
              <div className="connect-accounts">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.label}
                    type="button"
                    className="connect-account"
                    onClick={() => handleDemoAccount(account)}
                  >
                    <span className="connect-account-text">
                      <span className="connect-account-label">{account.label}</span>
                      <span className="connect-account-address">
                        {shortAddress(account.address)}
                      </span>
                    </span>
                    <ChevronRightIcon />
                  </button>
                ))}
              </div>

              <label className="connect-network">
                <input
                  type="checkbox"
                  checked={wrongNetwork}
                  onChange={(event) => setWrongNetwork(event.target.checked)}
                />
                <span>Ví đang ở sai mạng</span>
              </label>
            </div>
          )}

          <p className="connect-public-link">
            Chỉ muốn xem lô? <Link to="/trace">Tra cứu công khai, không cần ví</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
