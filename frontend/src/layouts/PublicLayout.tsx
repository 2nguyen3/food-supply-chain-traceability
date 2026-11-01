import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/common'
import { useSession } from '../app/session'
export function PublicLayout() {
  const [menu, setMenu] = useState(false)
  const location = useLocation()
  const { session } = useSession()
  useEffect(() => setMenu(false), [location.pathname])
  const dashboard = session?.wallet.roles[0]
  return (
    <div className="public-shell">
      <a className="skip-link" href="#main">
        Đến nội dung
      </a>
      <header className="public-header">
        <div className="container header-inner">
          <Logo />
          <nav className="public-nav" aria-label="Điều hướng chính">
            <NavLink
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              to="/"
              end
            >
              Trang chủ
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              to="/trace"
            >
              Tra cứu lô
            </NavLink>
          </nav>
          <div className="header-actions">
            <Link className="button" to={dashboard ? `/${dashboard}/overview` : '/connect'}>
              {dashboard ? 'Vào bảng điều khiển' : 'Kết nối ví'}
            </Link>
          </div>
          <button
            className="button secondary menu-toggle"
            aria-label={menu ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? 'Đóng' : 'Menu'}
          </button>
        </div>
        {menu && (
          <nav className="mobile-nav mobile-only" aria-label="Điều hướng di động">
            <Link className="nav-link" to="/">
              Trang chủ
            </Link>
            <Link className="nav-link" to="/trace">
              Tra cứu lô
            </Link>
            <Link className="nav-link" to={dashboard ? `/${dashboard}/overview` : '/connect'}>
              {dashboard ? 'Vào bảng điều khiển' : 'Kết nối ví'}
            </Link>
          </nav>
        )}
      </header>
      <main className="public-main" id="main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Logo light />
              <p>Truy xuất nguồn gốc lô dừa từ nông trại đến người tiêu dùng.</p>
            </div>
            <nav aria-label="Khám phá">
              <strong>Khám phá</strong>
              <Link to="/">Trang chủ</Link>
              <Link to="/trace">Tra cứu lô</Link>
              <Link to="/connect">Kết nối ví</Link>
            </nav>
            <div>
              <strong>Công nghệ</strong>
              <p>
                Ethereum Sepolia
                <br />
                NFT ERC-721
                <br />
                IPFS
              </p>
            </div>
          </div>
          <small>© 2026 COCOMARK</small>
        </div>
      </footer>
    </div>
  )
}
