/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { SessionProvider, useSession } from './session'
import { ErrorState } from '../components/ui'
import { ToastProvider } from '../components/ui/toast'
import { publicRoutes } from '../features/public/routes'
import { authRoutes } from '../features/auth/routes'
import { adminRoutes } from '../features/admin/routes'
import { farmerRoutes } from '../features/farmer/routes'
import { logisticsRoutes } from '../features/logistics/routes'
import { retailerRoutes } from '../features/retailer/routes'
import type { Role } from '../domain/types'
import { validateProductionConfig } from '../config/env'
function Root() {
  const missing = import.meta.env.PROD ? validateProductionConfig() : []
  return (
    <SessionProvider>
      <ToastProvider>
        {missing.length > 0 && (
          <div
            role="alert"
            style={{ padding: '8px 16px', background: 'var(--cream)', color: 'var(--cocoa)' }}
          >
            Thiếu cấu hình triển khai: {missing.join(', ')}
          </div>
        )}
        <Outlet />
      </ToastProvider>
    </SessionProvider>
  )
}
function Guard({ role }: { role: Role }) {
  const { session } = useSession()
  const location = useLocation()
  if (!session) return <Navigate to="/connect" state={{ from: location.pathname }} replace />
  if (session.wallet.chainId !== 11155111) return <Navigate to="/auth/network" replace />
  if (!session.wallet.roles.includes(role))
    return (
      <div className="container home-note">
        <ErrorState
          title="403 · Không có quyền truy cập"
          description="Vai trò của ví không cho phép xem khu vực này."
        />
      </div>
    )
  return <DashboardLayout role={role} />
}
const dashboard = (role: Role, children: typeof adminRoutes) => ({
  path: role,
  element: <Guard role={role} />,
  children: [{ index: true, element: <Navigate to="overview" replace /> }, ...children],
})
export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          ...publicRoutes,
          ...authRoutes,
          {
            path: '*',
            element: (
              <div className="container home-note">
                <ErrorState
                  title="404 · Không tìm thấy trang"
                  description="Đường dẫn này không tồn tại."
                />
              </div>
            ),
          },
        ],
      },
      dashboard('admin', adminRoutes),
      dashboard('farmer', farmerRoutes),
      dashboard('logistics', logisticsRoutes),
      dashboard('retailer', retailerRoutes),
    ],
  },
])
