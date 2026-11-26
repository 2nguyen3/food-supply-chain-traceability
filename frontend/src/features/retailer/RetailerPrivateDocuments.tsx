import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '../../app/session'
import { describeApiError, downloadVerifiedPrivateDocument, listPrivateDocuments, type DocumentListItem } from '../../services/documentsApi'
import { RetailerEmpty } from './components'

export function RetailerPrivateDocuments({ tokenId }: { tokenId: string }) {
  const { session } = useSession()
  return <RetailerPrivateContent key={`${session?.wallet.address}:${session?.expiresAt}:${tokenId}`} tokenId={tokenId} />
}

function RetailerPrivateContent({ tokenId }: { tokenId: string }) {
  const lifetime = useRef<AbortController | null>(null)
  const loading = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  const [documents, setDocuments] = useState<DocumentListItem[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    loading.current?.abort()
    const controller = new AbortController()
    loading.current = controller
    setDocuments(null)
    setError('')
    listPrivateDocuments(tokenId, controller.signal).then(
      (items) => { if (!controller.signal.aborted) setDocuments(items.filter((item) => item.doc_type === 'invoice')) },
      (cause) => { if (!controller.signal.aborted) setError(describeApiError(cause)) },
    )
  }, [tokenId])

  useEffect(() => { load(); return () => loading.current?.abort() }, [load])

  async function download(document: DocumentListItem) {
    setBusy(document.id)
    setNotice('')
    try {
      const file = await downloadVerifiedPrivateDocument(document.id, document.sha256, lifetime.current?.signal)
      const url = URL.createObjectURL(file.blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = file.filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Đã tải hóa đơn. SHA-256 của byte giải mã khớp bản ghi backend.')
    } catch (cause) { if (!lifetime.current?.signal.aborted) setNotice(describeApiError(cause)) }
    finally { setBusy('') }
  }

  return <section className="retailer-private-documents">
    <h2>Hóa đơn bán buôn riêng</h2>
    <p>Chỉ ví được cấp quyền mới tải được hóa đơn. Backend kiểm tra quyền trước khi giải mã.</p>
    {error ? <div role="alert">{error} <button className="retailer-button" onClick={load}>Thử lại</button></div>
      : documents === null ? <RetailerEmpty>Đang đọc tài liệu riêng…</RetailerEmpty>
        : documents.length === 0 ? <RetailerEmpty>Chưa có hóa đơn riêng mà ví này được phép xem.</RetailerEmpty>
          : <div className="retailer-list">{documents.map((document) => <div className="retailer-list-item" key={document.id}>
            <strong>Hóa đơn bán buôn</strong>
            <span>{(document.size_bytes / 1024).toFixed(1)} KB · {new Date(document.created_at).toLocaleString('vi-VN')}</span>
            <small className="retailer-mono">CID tệp mã hóa: {document.cid}</small>
            <small className="retailer-mono">SHA-256 bản rõ: {document.sha256}</small>
            <button className="retailer-button" disabled={!!busy} onClick={() => void download(document)}>{busy === document.id ? 'Đang tải…' : 'Tải hóa đơn'}</button>
          </div>)}</div>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
