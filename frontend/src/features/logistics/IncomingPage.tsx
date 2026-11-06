import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function LogisticsIncomingPage() {
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>
          Yêu cầu nhận lô
        </h1>
        <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
          Xác minh lần lượt 3 hash SHA-256 (metadata, PDF, ảnh) rồi mới chấp nhận. Từ chối luôn khả dụng. Chủ sở hữu chỉ đổi sau biên nhận xác nhận.
        </p>
      </header>

      {/* Yêu cầu đang chờ */}
      <div
        className="card"
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderRadius: 20,
          border: '1px solid var(--line, #E8E2D9)',
          background: '#FFFFFF',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#EEF5EE',
            color: '#275641',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            aspectRatio: '1 / 1',
            marginBottom: 16,
          }}
        >
          <DashboardIcon name="download" />
        </div>
        <strong style={{ fontSize: 16, color: '#1E293B' }}>Không có yêu cầu đang chờ</strong>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 0 0' }}>
          Khi Farmer gửi yêu cầu chuyển giao lô, yêu cầu sẽ hiện ở đây.
        </p>
      </div>

      {/* Lịch sử xử lý */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>Lịch sử xử lý</h2>
        <div
          className="card"
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 20,
            border: '1px solid var(--line, #E8E2D9)',
            background: '#FFFFFF',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#EEF5EE',
              color: '#275641',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              aspectRatio: '1 / 1',
              marginBottom: 14,
            }}
          >
            <DashboardIcon name="clock" />
          </div>
          <strong style={{ fontSize: 16, color: '#1E293B' }}>Chưa có lịch sử</strong>
        </div>
      </section>
    </div>
  )
}