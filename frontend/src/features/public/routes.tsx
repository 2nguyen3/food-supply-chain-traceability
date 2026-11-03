import type { RouteObject } from 'react-router-dom'
import { Placeholder } from '../../app/Placeholder'
import { HomePage } from './pages/HomePage'
import { TraceSearchPage } from './pages/TraceSearchPage'
import { TraceDemoPage } from './pages/TraceDemoPage'
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
    element: (
      <div className="container home-note">
        <Placeholder title="Hành trình lô" feature="Đọc dữ liệu công khai từ Sepolia và IPFS" />
      </div>
    ),
  },
]
