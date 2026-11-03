import type { RouteObject } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { TraceSearchPage } from './pages/TraceSearchPage'
import { TraceDemoPage } from './pages/TraceDemoPage'
import { TraceBlockchainPage } from './pages/TraceBlockchainPage'
export const publicRoutes: RouteObject[] = [
  {
    index: true,
    element: <HomePage />,
  },
  {
    path: 'trace',
    element: <TraceSearchPage />,
  },
  {
    path: 'trace/demo/:code',
    element: <TraceDemoPage />,
  },
  {
    path: 'trace/:chainId/:contractAddress/:tokenId',
    element: <TraceBlockchainPage />,
  },
]
