import type { RouteObject } from 'react-router-dom'
import { ConnectPage } from './ConnectPage'
import { NetworkPage } from './NetworkPage'
import { NoAccessPage } from './NoAccessPage'
import { SignPage } from './SignPage'
export const authRoutes: RouteObject[] = [
  {
    path: 'connect',
    element: <ConnectPage />,
  },
  {
    path: 'auth/sign',
    element: <SignPage />,
  },
  {
    path: 'auth/network',
    element: <NetworkPage />,
  },
  {
    path: 'auth/no-access',
    element: <NoAccessPage />,
  },
]
