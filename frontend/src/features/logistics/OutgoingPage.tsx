import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function LogisticsOutgoingPage() {
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Giao lô cho Retailer</h1>
        <p className="muted" style={{ margin: '4px 0 0 0' }}>
          Gửi yêu cầu chuyển (requestTransfer) tới Retailer. Mỗi lô tối đa một yêu cầu đang hoạt động. Không có đặt hàng, giá hay thanh toán.
        </p>
      </header>

      {/* Lô có thể chuyển */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Lô có thể chuyển</h2>
        <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#EEF5EE', color: '#2D5A43', marginBottom: 12 }}>
            <DashboardIcon name="truck" />
          </div>
          <strong style={{ fontSize: 15 }}>Bạn chưa sở hữu lô nào</strong>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 0 0' }}>
            Lô sẽ xuất hiện sau khi bạn chấp nhận yêu cầu từ Farmer.
          </p>
        </div>
      </section>

      {/* Yêu cầu đang chờ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Yêu cầu đang chờ</h2>
        <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#EEF5EE', color: '#2D5A43', marginBottom: 12 }}>
            <DashboardIcon name="route" />
          </div>
          <strong style={{ fontSize: 15 }}>Không có yêu cầu đang chờ</strong>
        </div>
      </section>

      {/* Lịch sử yêu cầu */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Lịch sử yêu cầu</h2>
        <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#F3F4F6', color: '#6B7280', marginBottom: 12 }}>
            <DashboardIcon name="box" />
          </div>
          <strong style={{ fontSize: 15 }}>Chưa có lịch sử</strong>
        </div>
      </section>

      {/* Lưu ý footer */}
      <div style={{ background: '#FAF7F2', border: '1px solid var(--line, #EBE5DF)', borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--muted, #78716C)' }}>
        🔒 Chuyển trực tiếp ERC-721 (transferFrom) không được hỗ trợ. Chỉ dùng requestTransfer &rarr; acceptTransfer.
      </div>
    </div>
  )
}