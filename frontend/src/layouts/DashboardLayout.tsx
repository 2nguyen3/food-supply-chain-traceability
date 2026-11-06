import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { Role } from '../domain/types'
import { Logo, NetworkBadge, WalletChip } from '../components/common'
import { Button } from '../components/ui'
import { useToast } from '../components/ui/toast'
import { useSession } from '../app/session'
import { useRecalls } from '../features/admin/incidentStore'
type NavIconName =
  'home' | 'users' | 'pin' | 'flag' | 'box' | 'plus' | 'send' | 'inbox' | 'truck' | 'tag'

type NavItem = { to: string; label: string; icon: NavIconName }

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  farmer: 'Farmer',
  logistics: 'Logistics',
  retailer: 'Retailer',
}

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'roles', label: 'Vai trò & quyền', icon: 'users' },
    { to: 'farms', label: 'Farmer ↔ farmId', icon: 'pin' },
    { to: 'incidents', label: 'Sự cố & thu hồi', icon: 'flag' },
    { to: 'batches', label: 'Tất cả lô', icon: 'box' },
  ],
  farmer: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'batches', label: 'Lô của tôi', icon: 'box' },
    { to: 'create', label: 'Tạo lô NFT', icon: 'plus' },
    { to: 'transfers', label: 'Chuyển giao', icon: 'send' },
  ],
  logistics: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'incoming', label: 'Yêu cầu nhận lô', icon: 'inbox' },
    { to: 'batches', label: 'Lô đang vận chuyển', icon: 'truck' },
    { to: 'outgoing', label: 'Giao cho Retailer', icon: 'send' },
  ],
  retailer: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'incoming', label: 'Yêu cầu nhận lô', icon: 'inbox' },
    { to: 'batches', label: 'Lô quản lý', icon: 'box' },
    { to: 'sales', label: 'Đánh dấu đã bán', icon: 'tag' },
    { to: 'incidents/new', label: 'Báo cáo sự cố', icon: 'flag' },
  ],
}

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const
  if (name === 'home')
    return (
      <svg {...common}>
        <path
          d="M4 20V9l8-5 8 5v11M4 20h16M9 20v-6h6v6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (name === 'users')
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M16 5.4a3.2 3.2 0 0 1 0 5.2M17.2 14.7c1.9.5 3.1 2 3.5 4.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  if (name === 'pin')
    return (
      <svg {...common}>
        <path
          d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  if (name === 'flag')
    return (
      <svg {...common}>
        <path
          d="M5 21V4m0 0h11.5l-2 3.5 2 3.5H5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (name === 'box')
    return (
      <svg {...common}>
        <path
          d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  if (name === 'plus')
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  if (name === 'send')
    return (
      <svg {...common}>
        <path
          d="m4 12 16-8-5.5 16-3-6.5L4 12Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m11.5 13.5 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  if (name === 'inbox')
    return (
      <svg {...common}>
        <path
          d="M4 5h16v11H4V5Zm0 7h4l1.5 2h5L16 12h4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (name === 'truck')
    return (
      <svg {...common}>
        <path
          d="M3 6h11v10H3V6Zm11 3h4l3 3v4h-7V9Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="17.5" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  return (
    <svg {...common}>
      <path
        d="M4 5h16v14H4V5Zm0 0 8 7 8-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6v5.5c0 4.5 2.9 7.6 7 9.5 4.1-1.9 7-5 7-9.5V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
export function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo to={`/${role}/overview`} />
      </div>
      <nav className="side-nav" aria-label="Điều hướng vai trò">
        {NAV[role].map((item) => (
          <NavLink
            key={item.to}
            to={`/${role}/${item.to}`}
            onClick={onNavigate}
            className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        <Link className="side-foot-link" to="/trace">
          <SearchIcon />
          Mở trang tra cứu công khai
        </Link>
      </div>
    </aside>
  )
}
export function Topbar({ role, onMenu }: { role: Role; onMenu: () => void }) {
  const { session, setProductionSession } = useSession()
  const { showToast } = useToast()
  const recalls = useRecalls()
  const navigate = useNavigate()
  const recallEntries = Object.values(recalls)

  function handleLogout() {
    setProductionSession(null)
    showToast('Đã đăng xuất', 'info')
    navigate('/connect')
  }

  function handleNotifications() {
    if (!recallEntries.length) {
      showToast('Không có thông báo mới')
      return
    }
    const latest = recallEntries[recallEntries.length - 1]
    showToast(
      `${recallEntries.length} thông báo: ${latest.batchCode} đã được thu hồi (${latest.incidentId})`,
      'info',
    )
  }

  return (
    <header className="topbar">
      <Button
        variant="secondary"
        className="menu-toggle"
        onClick={onMenu}
        aria-label="Mở menu điều hướng"
      >
        Menu
      </Button>
      <span className="role-pill">
        <ShieldIcon />
        {ROLE_LABELS[role]}
      </span>
      <div className="topbar-right">
        <WalletChip wallet={session?.wallet ?? null} label={ROLE_LABELS[role]} />
        <NetworkBadge chainId={session?.wallet.chainId} />
        <button
          type="button"
          className="topbar-icon"
          aria-label={recallEntries.length ? `Thông báo (${recallEntries.length})` : 'Thông báo'}
          title="Thông báo"
          onClick={handleNotifications}
        >
          <BellIcon />
          {recallEntries.length > 0 && <span className="topbar-badge">{recallEntries.length}</span>}
        </button>
        {session && (
          <Button variant="secondary" className="topbar-logout" onClick={handleLogout}>
            <LogoutIcon />
            Đăng xuất
          </Button>
        )}
      </div>
    </header>
  )
}
export function DashboardLayout({ role }: { role: Role }) {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  useEffect(() => setDrawer(false), [location.pathname])
  useEffect(() => {
    if (!drawer) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [drawer])
  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main">
        Đến nội dung
      </a>
      <Sidebar role={role} />
      {drawer && (
        <div className="drawer-backdrop">
          <button
            className="drawer-dismiss"
            aria-label="Đóng menu"
            onClick={() => setDrawer(false)}
          />
          <Sidebar role={role} onNavigate={() => setDrawer(false)} />
          <Button
            variant="secondary"
            style={{ position: 'absolute', top: 12, left: 220, zIndex: 42 }}
            onClick={() => setDrawer(false)}
            aria-label="Đóng menu"
          >
            ×
          </Button>
        </div>
      )}
      <Topbar role={role} onMenu={() => setDrawer(true)} />
      <main className="dashboard-main" id="main">
        <Outlet />
      </main>
    </div>
  )
}
