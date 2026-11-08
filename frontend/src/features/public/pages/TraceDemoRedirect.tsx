import { Navigate, useParams } from 'react-router-dom'

/** Đường dẫn demo cũ (/trace/demo/:code) chuyển sang tra cứu thật theo mã lô. */
export function TraceDemoRedirect() {
  const { code = '' } = useParams()
  return <Navigate to={`/trace?q=${encodeURIComponent(code)}`} replace />
}
