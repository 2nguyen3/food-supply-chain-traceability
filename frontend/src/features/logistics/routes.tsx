import type { RouteObject } from 'react-router-dom'
import LogisticsOverviewPage from './OverviewPage'
import LogisticsIncomingPage from './IncomingPage'
import LogisticsBatchesPage from './BatchesPage'
import LogisticsBatchDetailPage from './BatchDetailPage'
import LogisticsOutgoingPage from './OutgoingPage'

export const logisticsRoutes: RouteObject[] = [
  { path: 'overview', element: <LogisticsOverviewPage /> },
  { path: 'incoming', element: <LogisticsIncomingPage /> },
  { path: 'batches', element: <LogisticsBatchesPage /> },
  { path: 'batches/:code', element: <LogisticsBatchDetailPage /> },
  { path: 'batches/:code/transit', element: <LogisticsBatchDetailPage /> },
  { path: 'outgoing', element: <LogisticsOutgoingPage /> },
]