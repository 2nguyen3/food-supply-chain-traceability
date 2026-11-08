import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function LogisticsOutgoingPage() {
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>Giao cho Retailer</h1>
        <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
          Gửi yêu cầu chuyển (requestTransfer) tới Retailer. Mỗi lô tối đa một yêu cầu đang hoạt động. Không có đặt hàng, giá hay thanh toán.
        </p>
      </header>

      {/* Lô có thể chuyển */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>Lô có thể chuyển</h2>
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
            <DashboardIcon name="truck" />
          </div>
          <strong style={{ fontSize: 16, color: '#1E293B' }}>Bạn chưa sở hữu lô nào</strong>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 0 0' }}>
            Lô sẽ xuất hiện sau khi bạn chấp nhận yêu cầu từ Farmer.
          </p>
        </div>
      </section>

      {/* Yêu cầu đang chờ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>Yêu cầu đang chờ</h2>
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
            <DashboardIcon name="route" />
          </div>
          <strong style={{ fontSize: 16, color: '#1E293B' }}>Không có yêu cầu đang chờ</strong>
        </div>
      </section>

      {/* Lịch sử yêu cầu */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>Lịch sử yêu cầu</h2>
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

      {/* Lưu ý footer */}
      <div
        style={{
          background: '#FAF7F2',
          border: '1px solid var(--line, #E8E2D9)',
          borderRadius: 14,
          padding: '16px 20px',
          fontSize: 13,
          color: '#78716C',
        }}
      >
        🔒 Chuyển trực tiếp ERC-721 (transferFrom) không được hỗ trợ. Chỉ dùng requestTransfer &rarr; acceptTransfer.
      </div>
    </div>
  )
}