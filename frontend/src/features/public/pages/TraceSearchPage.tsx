import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '../../../components/ui'
import { HomeIcon } from '../components/HomeIcon'
import { findDemoCode, TRACE_DEMO_CODES } from '../mocks/traceSearchFixtures'
import '../styles/trace-search.css'

type SearchResult = {
  query: string
  mockUnavailable: boolean
  status: 'loading' | 'not-found' | 'unavailable'
}

export function TraceSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = (searchParams.get('q') ?? '').trim()
  const mockUnavailable = import.meta.env.DEV && searchParams.get('mockError') === 'unavailable'
  const [input, setInput] = useState(query)
  const [showEmptyHint, setShowEmptyHint] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<SearchResult>({
    query,
    mockUnavailable,
    status: 'loading',
  })

  useEffect(() => {
    setInput(query)
  }, [query])

  useEffect(() => {
    if (!query) return
    const timer = window.setTimeout(() => {
      if (mockUnavailable) {
        setResult({ query, mockUnavailable, status: 'unavailable' })
        return
      }
      const code = findDemoCode(query)
      if (code) {
        navigate(`/trace/demo/${code}`, { replace: true })
      } else {
        setResult({ query, mockUnavailable, status: 'not-found' })
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [query, mockUnavailable, attempt, navigate])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) {
      setShowEmptyHint(true)
      setSearchParams({})
      return
    }
    setShowEmptyHint(false)
    setResult({ query: trimmed, mockUnavailable: false, status: 'loading' })
    if (trimmed === query && !mockUnavailable) setAttempt((current) => current + 1)
    setSearchParams({ q: trimmed })
  }

  function retry() {
    setResult({ query, mockUnavailable: false, status: 'loading' })
    setSearchParams({ q: query })
    setAttempt((current) => current + 1)
  }

  const status = !query
    ? 'empty'
    : result.query !== query || result.mockUnavailable !== mockUnavailable
      ? 'loading'
      : result.status

  return (
    <div className="trace-search-page">
      <div className="container trace-search-inner">
        <p className="trace-search-eyebrow">Tra cứu công khai</p>
        <h1>Nhập mã lô hoặc quét QR</h1>
        <p className="trace-search-intro">
          Nhập batchCode (ví dụ COCONUT-001) hoặc tokenId. Không cần ví hay đăng nhập. Mã QR trên
          bao bì dẫn thẳng tới trang truy xuất của lô.
        </p>

        <form className="trace-search-form" role="search" aria-label="Tra cứu lô" onSubmit={submit}>
          <label htmlFor="trace-search-input">Mã lô hoặc token ID</label>
          <div className="trace-search-controls">
            <input
              id="trace-search-input"
              type="text"
              value={input}
              onChange={(event) => {
                setInput(event.target.value)
                setShowEmptyHint(false)
              }}
              placeholder="COCONUT-001 hoặc 1"
              aria-describedby={showEmptyHint ? 'trace-search-hint' : undefined}
            />
            <Button type="submit">
              <HomeIcon name="search" size={18} /> Tra cứu
            </Button>
          </div>
          {showEmptyHint && (
            <p id="trace-search-hint" className="trace-search-hint" role="status">
              Vui lòng nhập mã lô hoặc token ID để tra cứu.
            </p>
          )}
        </form>

        <div className="trace-search-examples" aria-label="Mã lô ví dụ">
          <span>Ví dụ, dữ liệu mô phỏng:</span>
          {TRACE_DEMO_CODES.map((code) => (
            <Link key={code} to={`/trace/demo/${code}`}>
              {code}
            </Link>
          ))}
        </div>

        <div className="trace-search-result" aria-live="polite">
          {status === 'empty' && (
            <EmptyState
              title="Chưa có mã tra cứu"
              description="Nhập mã lô hoặc mở một lô mẫu bên trên để xem trang truy xuất."
            />
          )}
          {status === 'loading' && <LoadingState label="Đang tra cứu dữ liệu mô phỏng…" />}
          {status === 'not-found' && (
            <div className="trace-search-not-found">
              <ErrorState
                title={`Không tìm thấy lô “${query}”`}
                description="Kiểm tra lại mã trên bao bì. Bản xem trước hiện chỉ có bốn mã mẫu COCONUT-001 đến COCONUT-004; dữ liệu Sepolia chưa được tích hợp."
              />
            </div>
          )}
          {status === 'unavailable' && (
            <ErrorState
              title="Dữ liệu mô phỏng tạm thời không khả dụng"
              description="Đây là trạng thái lỗi để kiểm tra giao diện trong môi trường phát triển, không phải sự cố RPC hay IPFS thật."
              action={
                <Button type="button" onClick={retry}>
                  Thử lại
                </Button>
              }
            />
          )}
        </div>

        <Card className="trace-search-qr">
          <div className="trace-search-qr-icon" aria-hidden="true">
            QR
          </div>
          <div>
            <h2>QR hoạt động thế nào?</h2>
            <p>
              QR chỉ chứa một địa chỉ web công khai, không chứa khóa, hóa đơn hay trạng thái. Khi có
              tích hợp thật, trạng thái sẽ được đọc tại thời điểm mở trang.
            </p>
            <p>
              Trong bản xem trước, URL dữ liệu mô phỏng có dạng <code>/trace/demo/COCONUT-001</code>
              . URL triển khai blockchain sẽ có dạng{' '}
              <code>
                /trace/{'{chainId}'}/{'{contractAddress}'}/{'{tokenId}'}
              </code>
              .
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
