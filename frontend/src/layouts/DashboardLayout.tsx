import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { Role } from '../domain/types'
import { Logo, NetworkBadge, WalletChip } from '../components/common'
import { Badge, Button, Select } from '../components/ui'
import { useSession } from '../app/session'
import { setPreviewRole } from '../mocks/session'
type NavItem = { to: string; label: string }
const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: 'overview', label: 'Tổng quan' },
    { to: 'roles', label: 'Vai trò & quyền' },
    { to: 'farms', label: 'Farmer ↔ farmId' },
    { to: 'incidents', label: 'Sự cố & thu hồi' },
    { to: 'batches', label: 'Tất cả lô' },
  ],
  farmer: [
    { to: 'overview', label: 'Tổng quan' },
    { to: 'batches', label: 'Lô của tôi' },
    { to: 'create', label: 'Tạo lô NFT' },
    { to: 'transfers', label: 'Chuyển giao' },
  ],
  logistics: [
    { to: 'overview', label: 'Tổng quan' },
    { to: 'incoming', label: 'Yêu cầu nhận lô' },
    { to: 'batches', label: 'Lô đang vận chuyển' },
    { to: 'outgoing', label: 'Giao cho Retailer' },
  ],
  retailer: [
    { to: 'overview', label: 'Tổng quan' },
    { to: 'incoming', label: 'Yêu cầu nhận lô' },
    { to: 'batches', label: 'Lô quản lý' },
    { to: 'sales', label: 'Đánh dấu đã bán' },
    { to: 'incidents/new', label: 'Báo cáo sự cố' },
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
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        <Link to="/trace">Mở trang tra cứu công khai</Link>
      </div>
    </aside>
  )
}
export function Topbar({ role, onMenu }: { role: Role; onMenu: () => void }) {
  const { session, setProductionSession } = useSession()
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
      <Badge>{role}</Badge>
      <div className="topbar-right">
        <WalletChip wallet={session?.wallet ?? null} />
        <NetworkBadge chainId={session?.wallet.chainId} />
        {session?.source === 'chain' && (
          <Button variant="secondary" onClick={() => setProductionSession(null)}>
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
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        zIndex: 70,
        background: 'white',
        padding: 8,
        border: '1px solid var(--line)',
        borderRadius: 12,
        boxShadow: 'var(--shadow)',
      }}
    >
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
  )
}
