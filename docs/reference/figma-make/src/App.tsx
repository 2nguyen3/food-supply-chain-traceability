import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './store'
import { PublicLayout, RequireRole, Root } from './components/layout/layout'
import { Landing, NotFound, ProductionTrace, TraceDetail, TraceSearch } from './pages/public'
import { Connect, NoAccess, Sign, WrongNetwork } from './pages/auth'
import { AdminOverview, FarmsPage, IncidentsPage, Investigate, RolesPage } from './pages/admin'
import { CreateWizard, FarmerOverview } from './pages/farmer'
import { LogisticsOverview } from './pages/logistics'
import { ReportIncident, RetailerOverview, Sales } from './pages/retailer'
import { BatchDetailPage, BatchListPage, IncomingPage, OutgoingPage } from './pages/shared'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Root />}>
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="trace" element={<TraceSearch />} />
              <Route path="trace/demo/:code" element={<TraceDetail />} />
              <Route path="trace/:chainId/:contractAddress/:tokenId" element={<ProductionTrace />} />
              <Route path="connect" element={<Connect />} />
              <Route path="auth/sign" element={<Sign />} />
              <Route path="auth/network" element={<WrongNetwork />} />
              <Route path="auth/no-access" element={<NoAccess />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            <Route path="admin" element={<RequireRole role="admin" />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<AdminOverview />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="farms" element={<FarmsPage />} />
              <Route path="incidents" element={<IncidentsPage />} />
              <Route path="incidents/:id" element={<Investigate />} />
              <Route path="batches" element={<BatchListPage role="admin" title="Tất cả lô" desc="Danh sách toàn bộ lô trên hệ thống. Admin không xem được hóa đơn riêng nếu chưa được cấp quyền." />} />
              <Route path="batches/:code" element={<BatchDetailPage role="admin" />} />
            </Route>

            <Route path="farmer" element={<RequireRole role="farmer" />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<FarmerOverview />} />
              <Route path="batches" element={<BatchListPage role="farmer" title="Lô của tôi" desc="Các lô bạn đã tạo. Chủ sở hữu NFT có thể đã chuyển sang Logistics hoặc Retailer." filter={(b, id) => b.uploader === id} />} />
              <Route path="batches/:code" element={<BatchDetailPage role="farmer" />} />
              <Route path="create" element={<CreateWizard />} />
              <Route path="transfers" element={<OutgoingPage role="farmer" />} />
            </Route>

            <Route path="logistics" element={<RequireRole role="logistics" />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<LogisticsOverview />} />
              <Route path="incoming" element={<IncomingPage role="logistics" />} />
              <Route path="batches" element={<BatchListPage role="logistics" title="Lô đang vận chuyển" desc="Lô Logistics đang sở hữu hoặc đã từng xử lý." filter={(b, id) => b.transfers.some((t) => t.to === id)} />} />
              <Route path="batches/:code/transit" element={<BatchDetailPage role="logistics" initialTab="temp" />} />
              <Route path="batches/:code" element={<BatchDetailPage role="logistics" />} />
              <Route path="outgoing" element={<OutgoingPage role="logistics" />} />
            </Route>

            <Route path="retailer" element={<RequireRole role="retailer" />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<RetailerOverview />} />
              <Route path="incoming" element={<IncomingPage role="retailer" />} />
              <Route path="batches" element={<BatchListPage role="retailer" title="Lô quản lý" desc="Các lô Retailer đang sở hữu. Sold vẫn thuộc Retailer." filter={(b, id) => b.transfers.some((t) => t.to === id)} />} />
              <Route path="batches/:code" element={<BatchDetailPage role="retailer" />} />
              <Route path="sales" element={<Sales />} />
              <Route path="incidents/new" element={<ReportIncident />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
