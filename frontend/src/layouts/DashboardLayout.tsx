import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { Role } from '../domain/types'
import { Logo, NetworkBadge, WalletChip } from '../components/common'
import { DashboardIcon, type DashboardIconName } from '../components/common/DashboardIcon'
import { Button, Select } from '../components/ui'
import { useSession } from '../app/session'
import { setPreviewRole } from '../mocks/session'
type NavItem = { to: string; label: string; icon: DashboardIconName }
const ROLE_HEADER: Record<Role, { label: string; icon: DashboardIconName }> = {
  admin: { label: 'Admin', icon: 'shield' },
  farmer: { label: 'Farmer', icon: 'leaf' },
  logistics: { label: 'Logistics', icon: 'truck' },
  retailer: { label: 'Retailer', icon: 'store' },
}
const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'roles', label: 'Vai trò & quyền', icon: 'users' },
    { to: 'farms', label: 'Farmer ↔ farmId', icon: 'map' },
    { to: 'incidents', label: 'Sự cố & thu hồi', icon: 'flag' },
    { to: 'batches', label: 'Tất cả lô', icon: 'box' },
  ],
  farmer: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'batches', label: 'Lô của tôi', icon: 'box' },
    { to: 'create', label: 'Tạo lô NFT', icon: 'plus' },
    { to: 'transfers', label: 'Chuyển giao', icon: 'route' },
  ],
  logistics: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'incoming', label: 'Yêu cầu nhận lô', icon: 'download' },
    { to: 'batches', label: 'Lô đang vận chuyển', icon: 'truck' },
    { to: 'outgoing', label: 'Giao cho Retailer', icon: 'route' },
  ],
  retailer: [
    { to: 'overview', label: 'Tổng quan', icon: 'home' },
    { to: 'incoming', label: 'Yêu cầu nhận lô', icon: 'download' },
    { to: 'batches', label: 'Lô quản lý', icon: 'box' },
    { to: 'sales', label: 'Đánh dấu đã bán', icon: 'store' },
    { to: 'incidents/new', label: 'Báo cáo sự cố', icon: 'flag' },
  ],
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
            <DashboardIcon name={item.icon} className="side-icon" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        <Link to="/trace">
          <DashboardIcon name="search" className="side-foot-icon" />
          Mở trang tra cứu công khai
        </Link>
      </div>
    </aside>
  )
}
export function Topbar({ role, onMenu }: { role: Role; onMenu: () => void }) {
  const { session, setProductionSession } = useSession()
  const activeRole = session?.wallet.roles.includes(role) ? role : null
  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button
          type="button"
          className="menu-toggle topbar-icon-button"
          onClick={onMenu}
          aria-label="Mở menu điều hướng"
        >
          <DashboardIcon name="menu" />
        </button>
        {activeRole ? (
          <span className={`topbar-role topbar-role-${activeRole}`}>
            <DashboardIcon name={ROLE_HEADER[activeRole].icon} />
            {ROLE_HEADER[activeRole].label}
          </span>
        ) : (
          <span className="topbar-role topbar-role-unassigned">Chưa có vai trò</span>
        )}
        <WalletChip
          wallet={session?.wallet ?? null}
          label={activeRole ? ROLE_HEADER[activeRole].label : undefined}
        />
      </div>
      <div className="topbar-right">
        <NetworkBadge chainId={session?.wallet.chainId} />
        <button
          type="button"
          className="topbar-icon-button topbar-bell"
          aria-label="Thông báo chưa khả dụng"
          title="Thông báo chưa khả dụng"
          disabled
        >
          <DashboardIcon name="bell" />
        </button>
        <button
          type="button"
          className="topbar-logout"
          aria-label="Đăng xuất"
          title={
            session?.source === 'chain'
              ? 'Đăng xuất'
              : 'Phiên xem trước: đổi vai trò trong công cụ development'
          }
          disabled={session?.source !== 'chain'}
          onClick={() => setProductionSession(null)}
        >
          <DashboardIcon name="logout" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  )
}
export function DashboardLayout({ role }: { role: Role }) {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const { session } = useSession()
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
        {session?.source === 'development-preview' && (
          <p className="muted" role="note">
            Dữ liệu mô phỏng · chỉ xem trước giao diện, không xác thực on-chain.
          </p>
        )}
        <Outlet />
      </main>
    </div>
  )
}
export function DevelopmentPreview() {
  const { session } = useSession()
  const navigate = useNavigate()
  if (!import.meta.env.DEV) return null
  return (
    <div
      id="development-preview"
      style={{
        display: 'flex',
        justifyContent: 'center',
        borderTop: '1px solid var(--line)',
        background: 'var(--ivory)',
        padding: '12px 16px',
      }}
    >
      <div style={{ width: 'min(100%, 280px)' }}>
        <Select
          label="Xem trước vai trò (mô phỏng)"
          value={session?.source === 'development-preview' ? session.wallet.roles[0] : ''}
          onChange={(event) => {
            const role = (event.target.value || null) as Role | null
            setPreviewRole(role)
            navigate(role ? `/${role}/overview` : '/trace')
          }}
        >
          <option value="">Không chọn</option>
          <option value="admin">Admin</option>
          <option value="farmer">Farmer</option>
          <option value="logistics">Logistics</option>
          <option value="retailer">Retailer</option>
        </Select>
      </div>
    </div>
  )
}
