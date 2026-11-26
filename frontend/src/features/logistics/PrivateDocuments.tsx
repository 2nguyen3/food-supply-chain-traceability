import { useEffect, useRef, useState } from 'react'
import {
  describeApiError,
  downloadVerifiedPrivateDocument,
  listPrivateDocuments,
  type DocumentListItem,
} from '../../services/documentsApi'
import { useSession } from '../../app/session'

/** Hóa đơn được giải mã ở backend sau khi kiểm ACL + vai trò on-chain. */
export function LogisticsPrivateDocuments({ tokenId }: { tokenId: string }) {
  const { session } = useSession()
  return (
    <LogisticsPrivateContent
      key={`${session?.wallet.address}:${session?.expiresAt}:${tokenId}`}
      tokenId={tokenId}
    />
  )
}

function LogisticsPrivateContent({ tokenId }: { tokenId: string }) {
  const [documents, setDocuments] = useState<DocumentListItem[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [reload, setReload] = useState(0)
  const lifetime = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    void listPrivateDocuments(tokenId, controller.signal).then(
      (items) => {
        if (!controller.signal.aborted)
          setDocuments(items.filter((item) => item.doc_type === 'invoice'))
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) setError(describeApiError(reason))
      },
    )
    return () => controller.abort()
  }, [tokenId, reload])

  function refresh() {
    setDocuments(null)
    setError('')
    setNotice('')
    setBusy('')
    setReload((count) => count + 1)
  }

  async function download(doc: DocumentListItem) {
    if (busy) return
    setBusy(doc.id)
    setNotice('')
    try {
      const file = await downloadVerifiedPrivateDocument(doc.id, doc.sha256, lifetime.current?.signal)
      if (lifetime.current?.signal.aborted) return
      const url = URL.createObjectURL(file.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.filename
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Đã tải hóa đơn: SHA-256 bản giải mã khớp bản ghi backend.')
    } catch (reason) {
      if (!lifetime.current?.signal.aborted) setNotice(describeApiError(reason))
    } finally {
      if (!lifetime.current?.signal.aborted) setBusy('')
    }
  }

  return (
    <section className="card" style={{ padding: 22, display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>Hóa đơn bán buôn riêng</h2>
        <p style={{ color: '#64748B', fontSize: 13 }}>
          Chỉ ví được Farmer cấp quyền và còn vai trò trên hợp đồng mới được tải.
          Backend kiểm tra quyền trước khi giải mã AES-256-GCM; không công khai PDF trên IPFS.
        </p>
      </div>
      <div>
        <button type="button" onClick={refresh}
          style={{ padding: '8px 14px', cursor: 'pointer' }}>
          Làm mới quyền đọc
        </button>
      </div>
      {error ? (
        <p role="alert" style={{ color: '#B91C1C' }}>{error}</p>
      ) : documents === null ? (
        <p role="status">Đang kiểm tra quyền và tải danh sách hóa đơn…</p>
      ) : documents.length === 0 ? (
        <p>Không có hóa đơn riêng mà ví Logistics này được phép xem.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {documents.map((doc) => (
            <article key={doc.id} style={{ padding: 14, border: '1px solid #E8E2D9', borderRadius: 12 }}>
              <strong>Hóa đơn bán buôn</strong>
              <p style={{ fontSize: 13 }}>{(doc.size_bytes / 1024).toFixed(1)} KB · {doc.mime_type}</p>
              <p style={{ overflowWrap: 'anywhere', fontSize: 12 }}>CID ciphertext: {doc.cid}</p>
              <p style={{ overflowWrap: 'anywhere', fontSize: 12 }}>SHA-256 bản rõ: {doc.sha256}</p>
              <button type="button" disabled={busy !== ''} onClick={() => void download(doc)}
                style={{ padding: '9px 16px', cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy === doc.id ? 'Đang giải mã…' : 'Tải hóa đơn'}
              </button>
            </article>
          ))}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  )
}
