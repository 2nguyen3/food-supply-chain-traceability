import { useCallback, useEffect, useState } from 'react'
import { sha256Hex } from '../../lib/hash'
import { describeApiError, downloadPrivateDocument, listPrivateDocuments, type DocumentListItem } from '../../services/documentsApi'
import { RetailerEmpty } from './components'

export function RetailerPrivateDocuments({ tokenId }: { tokenId: string }) {
  const [documents, setDocuments] = useState<DocumentListItem[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setDocuments(null)
    setError('')
    listPrivateDocuments(tokenId).then(
      (items) => setDocuments(items.filter((item) => item.doc_type === 'invoice')),
      (cause) => setError(describeApiError(cause)),
    )
  }, [tokenId])

  useEffect(() => { load() }, [load])

  async function download(document: DocumentListItem) {
    setBusy(document.id)
    setNotice('')
    try {
      const file = await downloadPrivateDocument(document.id)
      const actualHash = await sha256Hex(file.blob)
      if (actualHash.toLowerCase() !== document.sha256.toLowerCase()) {
        setNotice('SHA-256 của hóa đơn không khớp với bản ghi backend. Tệp chưa được tải xuống.')
        return
      }
      const url = URL.createObjectURL(file.blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = file.filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Đã tải hóa đơn. SHA-256 của byte giải mã khớp bản ghi backend.')
    } catch (cause) { setNotice(describeApiError(cause)) }
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
