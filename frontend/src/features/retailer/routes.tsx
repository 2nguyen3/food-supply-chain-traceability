import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
export const retailerRoutes: RouteObject[] = [
  { path: 'overview', element: <Placeholder title="Tổng quan" feature="Lô của nhà bán lẻ" /> },
  {
    path: 'incoming',
    element: <Placeholder title="Yêu cầu nhận lô" feature="Xác minh hồ sơ trước khi nhận" />,
  },
  {
    path: 'batches',
    element: <Placeholder title="Lô quản lý" feature="Danh sách lô Retailer xử lý" />,
  },
  {
    path: 'batches/:code',
    element: <Placeholder title="Chi tiết lô" feature="Hồ sơ và lịch sử lô" />,
  },
  {
    path: 'sales',
    element: <Placeholder title="Đánh dấu đã bán" feature="Ghi nhận trạng thái Sold" />,
  },
  {
    path: 'incidents/new',
    element: <Placeholder title="Báo cáo sự cố" feature="Gửi bằng chứng và mô tả sự cố" />,
  },
]
