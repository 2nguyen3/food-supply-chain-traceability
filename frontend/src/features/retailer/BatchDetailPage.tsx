import { useParams, Link } from 'react-router-dom'

export default function RetailerBatchDetailPage() {
  const { code } = useParams<{ code: string }>()
  const displayCode = code ? `"${code}"` : '":code"'

  return (
    <div style={{ width: '100%', padding: '16px 0' }}>
      <div
        style={{
          width: '100%',
          minHeight: '440px',
          backgroundColor: '#FFF7EE',
          border: '1.5px solid #F5E5D3',
          borderRadius: '28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            border: '1px solid #F3DFC8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            color: '#B45309',
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2
          style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#1E293B',
            margin: '0 0 10px 0',
          }}
        >
          Không tìm thấy lô {displayCode}
        </h2>

        <p style={{ fontSize: '15px', color: '#64748B', margin: '0 0 28px 0' }}>
          Mã lô không tồn tại.
        </p>

        <Link
          to="/retailer/overview"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#275641',
            color: '#FFFFFF',
            padding: '12px 28px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            textDecoration: 'none',
          }}
        >
          Về tổng quan
        </Link>
      </div>
    </div>
  )
}