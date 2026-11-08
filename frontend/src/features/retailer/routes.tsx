import type { RouteObject } from 'react-router-dom'
import RetailerOverviewPage from './OverviewPage'
import RetailerIncomingPage from './IncomingPage'
import RetailerBatchesPage from './BatchesPage'
import RetailerBatchDetailPage from './BatchDetailPage'
import RetailerSalesPage from './SalesPage'
import RetailerNewIncidentPage from './NewIncidentPage'

export const retailerRoutes: RouteObject[] = [
  { path: 'overview', element: <RetailerOverviewPage /> },
  { path: 'incoming', element: <RetailerIncomingPage /> },
  { path: 'batches', element: <RetailerBatchesPage /> },
  { path: 'batches/:code', element: <RetailerBatchDetailPage /> },
  { path: 'sales', element: <RetailerSalesPage /> },
  { path: 'incidents/new', element: <RetailerNewIncidentPage /> },
]