import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
export const adminRoutes: RouteObject[] = [
  {
    path: 'overview',
    element: <Placeholder title="Tổng quan" feature="Chỉ số lô, vai trò và sự cố" />,
  },
  {
    path: 'roles',
    element: <Placeholder title="Vai trò & quyền" feature="Cấp và thu hồi vai trò on-chain" />,
  },
  {
    path: 'farms',
    element: <Placeholder title="Farmer ↔ farmId" feature="Quản lý liên kết nông trại" />,
  },
  {
    path: 'incidents',
    element: <Placeholder title="Sự cố & thu hồi" feature="Theo dõi báo cáo sự cố" />,
  },
  {
    path: 'incidents/:id',
    element: <Placeholder title="Điều tra sự cố" feature="Truy ngược và quyết định thu hồi" />,
  },
  {
    path: 'batches',
    element: <Placeholder title="Tất cả lô" feature="Danh sách lô trong hệ thống" />,
  },
  {
    path: 'batches/:code',
    element: <Placeholder title="Chi tiết lô" feature="Thông tin lô dành cho Admin" />,
  },
]
