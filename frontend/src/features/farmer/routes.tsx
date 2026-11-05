import type { RouteObject } from 'react-router-dom'
import { FarmerOverviewPage } from './pages/FarmerOverviewPage'
import { FarmerBatchesPage } from './pages/FarmerBatchesPage'
import { FarmerBatchDetailPage } from './pages/FarmerBatchDetailPage'
import { FarmerCreatePage } from './pages/FarmerCreatePage'
import { FarmerTransfersPage } from './pages/FarmerTransfersPage'
export const farmerRoutes: RouteObject[] = [
  { path: 'overview', element: <FarmerOverviewPage /> },
  { path: 'batches', element: <FarmerBatchesPage /> },
  {
    path: 'batches/:code',
    element: <FarmerBatchDetailPage />,
  },
  {
    path: 'create',
    element: <FarmerCreatePage />,
  },
  {
    path: 'transfers',
    element: <FarmerTransfersPage />,
  },
]
