import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
export const logisticsRoutes: RouteObject[] = [
  { path: 'overview', element: <Placeholder title="Tổng quan" feature="Lô đang vận chuyển" /> },
  {
    path: 'incoming',
    element: <Placeholder title="Yêu cầu nhận lô" feature="Xác minh hồ sơ trước khi nhận" />,
  },
  {
    path: 'batches',
    element: <Placeholder title="Lô đang vận chuyển" feature="Danh sách lô Logistics xử lý" />,
  },
  {
    path: 'batches/:code',
    element: <Placeholder title="Chi tiết lô" feature="Hồ sơ và lịch sử lô" />,
  },
  {
    path: 'batches/:code/transit',
    element: <Placeholder title="Theo dõi vận chuyển" feature="Nhiệt độ và vị trí quan sát" />,
  },
  {
    path: 'outgoing',
    element: <Placeholder title="Giao cho Retailer" feature="Yêu cầu bàn giao" />,
  },
]
