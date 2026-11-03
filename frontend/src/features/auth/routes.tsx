import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
export const authRoutes: RouteObject[] = [
  {
    path: 'connect',
    element: (
      <div className="container home-note">
        <Placeholder title="Kết nối ví" feature="Kết nối MetaMask" />
      </div>
    ),
  },
  {
    path: 'auth/sign',
    element: (
      <div className="container home-note">
        <Placeholder title="Xác nhận chữ ký" feature="Ký challenge và xác thực phiên" />
      </div>
    ),
  },
  {
    path: 'auth/network',
    element: (
      <div className="container home-note">
        <Placeholder title="Sai mạng" feature="Chuyển sang Ethereum Sepolia (11155111)" />
      </div>
    ),
  },
  {
    path: 'auth/no-access',
    element: (
      <div className="container home-note">
        <Placeholder title="Chưa được cấp quyền" feature="Vai trò được kiểm tra từ hợp đồng" />
      </div>
    ),
  },
]
