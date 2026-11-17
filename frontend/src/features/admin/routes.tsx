import type { RouteObject } from 'react-router-dom'
import { BatchDetailPage } from './BatchDetailPage'
import { BatchesPage } from './BatchesPage'
import { FarmsPage } from './FarmsPage'
import { IncidentDetailPage } from './IncidentDetailPage'
import { IncidentsPage } from './IncidentsPage'
import { AdminOverviewPage } from './OverviewPage'
import { RolesPage } from './RolesPage'
export const adminRoutes: RouteObject[] = [
  {
    path: 'overview',
    element: <AdminOverviewPage />,
  },
  {
    path: 'roles',
    element: <RolesPage />,
  },
  {
    path: 'farms',
    element: <FarmsPage />,
  },
  {
    path: 'incidents',
    element: <IncidentsPage />,
  },
  {
    path: 'incidents/:id',
    element: <IncidentDetailPage />,
  },
  {
    path: 'batches',
    element: <BatchesPage />,
  },
  {
    path: 'batches/:code',
    element: <BatchDetailPage />,
  },
]
