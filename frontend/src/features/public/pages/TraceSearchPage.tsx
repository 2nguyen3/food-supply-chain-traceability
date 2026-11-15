import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, EmptyState, ErrorState, LoadingState } from '../../../components/ui'
import { HomeIcon } from '../components/HomeIcon'
import { QrScanTools, QrScanView } from '../components/QrScanner'
import { useQrScanner } from '../components/useQrScanner'
import {
  resolveTraceTarget,
  sampleBatchCodes,
  type TraceLookup,
} from '../services/publicChainReader'
import '../styles/trace-search.css'

type Failure = Exclude<TraceLookup, { kind: 'found' }>
type SearchResult = { query: string; attempt: number; failure: Failure }

export function TraceSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = (searchParams.get('q') ?? '').trim()
  const [input, setInput] = useState(query)
  const [showEmptyHint, setShowEmptyHint] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<SearchResult | null>(null)

  useEffect(() => {
    setInput(query)
  }, [query])

  useEffect(() => {
    if (!query) return
    const controller = new AbortController()
    resolveTraceTarget(query, controller.signal)
      .then((lookup) => {
        if (lookup.kind === 'found') navigate(lookup.path, { replace: true })
        else setResult({ query, attempt, failure: lookup })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error(error)
        setResult({ query, attempt, failure: { kind: 'rpcUnavailable' } })
      })
    return () => controller.abort()
  }, [query, attempt, navigate])

  function search(text: string) {
    const trimmed = text.trim()
    if (!trimmed) {
      setShowEmptyHint(true)
      setSearchParams({})
      return
    }
    setShowEmptyHint(false)
    if (trimmed === query) setAttempt((current) => current + 1)
    setSearchParams({ q: trimmed })
  }

  const scanner = useQrScanner((text) => {
    setInput(text)
    search(text)
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    search(input)
  }

  const failure =
    query && result && result.query === query && result.attempt === attempt ? result.failure : null
  const status = !query ? 'empty' : failure ? 'failed' : 'loading'

  return (
    <div className="trace-search-page">
      <div className="container trace-search-inner">
        <p className="trace-search-eyebrow">Tra cứu công khai</p>
        <h1>Nhập mã lô hoặc quét QR</h1>
        <p className="trace-search-intro">
          Nhập mã lô (ví dụ COCONUT-001), token ID hoặc dán đường dẫn của mã QR. Không cần ví hay
          đăng nhập. Mã QR trên bao bì dẫn thẳng tới trang truy xuất của lô.
        </p>

        <form className="trace-search-form" role="search" aria-label="Tra cứu lô" onSubmit={submit}>
          <label htmlFor="trace-search-input">Mã lô, token ID hoặc đường dẫn QR</label>
          <div className="trace-search-controls">
            <div className="trace-search-field">
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
              <QrScanTools scanner={scanner} />
            </div>
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

        <QrScanView scanner={scanner} />

        {sampleBatchCodes.length > 0 && (
          <div className="trace-search-examples" aria-label="Mã lô ví dụ">
            <span>Ví dụ:</span>
            {sampleBatchCodes.map((code) => (
              <Link key={code} to={`/trace?q=${code}`}>
                {code}
              </Link>
            ))}
          </div>
        )}

        <div className="trace-search-result" aria-live="polite">
          {status === 'empty' && (
            <EmptyState
              title="Chưa có mã tra cứu"
              description="Nhập mã lô, token ID hoặc quét mã QR để xem trang truy xuất."
            />
          )}
          {status === 'loading' && <LoadingState label="Đang tra cứu…" />}
          {failure?.kind === 'notFound' && (
            <div className="trace-search-not-found">
              <ErrorState
                title={`Không tìm thấy lô “${query.length > 60 ? `${query.slice(0, 60)}…` : query}”`}
                description="Kiểm tra lại mã trên bao bì hoặc quét lại mã QR."
              />
            </div>
          )}
          {failure?.kind === 'unconfigured' && (
            <ErrorState
              title="Chưa cấu hình kết nối blockchain"
              description={`Thiếu cấu hình: ${failure.missing.join(', ')}.`}
            />
          )}
          {(failure?.kind === 'rpcTimeout' || failure?.kind === 'rpcUnavailable') && (
            <ErrorState
              title={
                failure.kind === 'rpcTimeout'
                  ? 'Máy chủ blockchain phản hồi quá lâu'
                  : 'Không kết nối được blockchain'
              }
              description="Đây là sự cố đọc dữ liệu, không có nghĩa lô không tồn tại. Vui lòng thử lại."
              action={
                <Button type="button" onClick={() => setAttempt((current) => current + 1)}>
                  Thử lại
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
