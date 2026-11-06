import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function LogisticsIncomingPage() {
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Yêu cầu nhận lô</h1>
        <p className="muted" style={{ margin: '4px 0 0 0' }}>
          Xác minh lần lượt 3 hash SHA-256 (metadata, PDF, ảnh) rồi mới chấp nhận. Từ chối luôn khả dụng. Chủ sở hữu chỉ đổi sau biên nhận xác nhận.
        </p>
      </header>

      {/* Empty State */}
      <div className="card" style={{ padding: 56, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ padding: 12, borderRadius: '50%', background: '#EEF5EE', color: '#2D5A43', marginBottom: 12 }}>
          <DashboardIcon name="download" />
        </div>
        <strong style={{ fontSize: 15 }}>Không có yêu cầu đang chờ</strong>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 0 0' }}>
          Khi Farmer gửi yêu cầu chuyển, yêu cầu sẽ hiện ở đây. Thử chuyển sang ví Farmer A.
        </p>
      </div>

      {/* Lịch sử xử lý */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Lịch sử xử lý</h2>
        <div className="card" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#F3F4F6', color: '#6B7280', marginBottom: 12 }}>
            <DashboardIcon name="box" />
          </div>
          <strong style={{ fontSize: 15 }}>Chưa có lịch sử</strong>
        </div>
      </section>
    </div>
  )
}