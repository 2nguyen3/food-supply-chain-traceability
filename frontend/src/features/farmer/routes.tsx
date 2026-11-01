import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
export const farmerRoutes: RouteObject[] = [
  { path: 'overview', element: <Placeholder title="Tổng quan" feature="Lô của nông trại" /> },
  { path: 'batches', element: <Placeholder title="Lô của tôi" feature="Danh sách lô đã tạo" /> },
  {
    path: 'batches/:code',
    element: <Placeholder title="Chi tiết lô" feature="Hồ sơ và lịch sử lô" />,
  },
  {
    path: 'create',
    element: <Placeholder title="Tạo lô NFT" feature="Quy trình tạo lô 1.000 kg" />,
  },
  {
    path: 'transfers',
    element: <Placeholder title="Chuyển giao" feature="Yêu cầu chuyển cho Logistics" />,
  },
]
