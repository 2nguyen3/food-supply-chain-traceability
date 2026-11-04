import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
import { FarmerOverviewPage } from './pages/FarmerOverviewPage'
import { FarmerBatchesPage } from './pages/FarmerBatchesPage'
import { FarmerBatchDetailPage } from './pages/FarmerBatchDetailPage'
export const farmerRoutes: RouteObject[] = [
  { path: 'overview', element: <FarmerOverviewPage /> },
  { path: 'batches', element: <FarmerBatchesPage /> },
  {
    path: 'batches/:code',
    element: <FarmerBatchDetailPage />,
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
