import { useState, type FormEvent } from 'react'
import { sha256Hex, toBytes32 } from '../../lib/hash'
import { bindDocument, describeApiError, uploadDocument } from '../../services/documentsApi'
import { findEvent, sendTransaction, toTxError } from '../../services/tx'
import { RetailerBadge, RetailerEmpty, RetailerFlags, RetailerNotice } from './components'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import './styles/retailer.css'

interface ConfirmedReport { incidentId: string; documentId: string; tokenId: string }

export default function RetailerNewIncidentPage() {
  const { data, address, error, loading, reload } = useRetailerSnapshot()
  const [tokenId, setTokenId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [fileHash, setFileHash] = useState('')
  const [uploadedCid, setUploadedCid] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState<ConfirmedReport | null>(null)
  const eligible = data?.batches.filter((batch) => batch.lifecycle === 'Delivered' || batch.lifecycle === 'Sold') ?? []
  const selected = eligible.find((batch) => batch.tokenId === tokenId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!address || !selected || !file || busy || confirmed) return
    if (description.trim().length < 10) {
      setMessage('Mô tả cần ít nhất 10 ký tự.')
      return
    }
    if (file.type !== 'application/pdf' || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setMessage('Chọn tệp PDF hợp lệ, dung lượng tối đa 10 MB.')
      return
    }
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (new TextDecoder().decode(header) !== '%PDF-') {
      setMessage('Nội dung tệp không phải PDF hợp lệ.')
      return
    }
    setBusy(true)
    setMessage('Đang tính SHA-256 và tải PDF lên dịch vụ tài liệu…')
    try {
      const localHash = await sha256Hex(file)
      setFileHash(localHash)
      const uploaded = await uploadDocument(file, file.name, 'incident_report')
      if (uploaded.sha256.toLowerCase() !== localHash.toLowerCase()) {
        setMessage('Hash PDF trả về từ máy chủ không khớp byte của tệp. Chưa gửi giao dịch.')
        return
      }
      setUploadedCid(uploaded.cid)
      setMessage('Đã lưu bản nháp. Đang chờ MetaMask và biên nhận blockchain…')
      const tx = await sendTransaction(address, (contract) => contract.reportIncident(BigInt(selected.tokenId), uploaded.cid, toBytes32(localHash)))
      const incidentId = findEvent(tx.receipt, 'IncidentReported')?.incidentId?.toString()
      if (!incidentId) {
        setMessage('Giao dịch đã xác nhận nhưng chưa đọc được mã sự cố từ biên nhận. Hãy kiểm tra giao dịch trước khi gửi lại.')
        return
      }
      setConfirmed({ incidentId, documentId: uploaded.id, tokenId: selected.tokenId })
      try {
        await bindDocument(uploaded.id, selected.tokenId)
        setMessage(`Sự cố #${incidentId} đã xác nhận trên blockchain (${tx.hash}); PDF đã gắn với lô ${selected.code}.`)
        setConfirmed(null)
        setFile(null)
        setDescription('')
        reload()
      } catch (cause) {
        setMessage(`Sự cố #${incidentId} đã xác nhận trên blockchain. Chưa gắn được PDF vào backend: ${describeApiError(cause)}`)
      }
    } catch (cause) {
      setMessage(cause instanceof Error && cause.name === 'HttpError' ? describeApiError(cause) : toTxError(cause).message)
    } finally { setBusy(false) }
  }

  async function retryBind() {
    if (!confirmed || busy) return
    setBusy(true)
    try {
      await bindDocument(confirmed.documentId, confirmed.tokenId)
      setMessage(`Đã gắn PDF cho sự cố #${confirmed.incidentId}.`)
      setConfirmed(null); setFile(null); setDescription(''); reload()
    } catch (cause) { setMessage(describeApiError(cause)) }
    finally { setBusy(false) }
  }

  return <div className="retailer-page">
    <header><h1>Báo cáo sự cố</h1><p>Retailer báo cáo lô đang sở hữu ở trạng thái Delivered hoặc Sold, kể cả lô đã hết hạn hoặc thu hồi. Tệp PDF là bằng chứng của báo cáo.</p></header>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {message && <div className="retailer-card" role="status">{message}{confirmed && <div className="retailer-actions"><button className="retailer-button" disabled={busy} onClick={() => void retryBind()}>Thử gắn tệp lại</button></div>}</div>}
    {data && <div className="retailer-grid">
      <section className="retailer-card"><h2>Tạo báo cáo</h2>{!eligible.length ? <RetailerEmpty>Không có lô đủ điều kiện báo cáo.</RetailerEmpty> : <form className="retailer-form" onSubmit={(event) => void submit(event)}>
        <label>Lô liên quan<select value={tokenId} onChange={(event) => setTokenId(event.target.value)} required disabled={busy || !!confirmed}><option value="">Chọn lô…</option>{eligible.map((batch) => <option value={batch.tokenId} key={batch.tokenId}>{batch.code} · NFT #{batch.tokenId}</option>)}</select></label>
        {selected && <div><RetailerBadge batch={selected} /><RetailerFlags batch={selected} /></div>}
        <label>Mô tả quan sát<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} required rows={4} disabled={busy || !!confirmed} placeholder="Nêu những gì đã quan sát, không kết luận nguyên nhân." /></label>
        <label>Bằng chứng PDF<input type="file" accept="application/pdf,.pdf" required disabled={busy || !!confirmed} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        {file && <p className="retailer-muted">{file.name} · {(file.size / 1024).toFixed(1)} KB. SHA-256 được tính từ byte PDF gốc khi gửi.</p>}
        {fileHash && <p className="retailer-muted retailer-mono">SHA-256 PDF: {fileHash}</p>}
        {uploadedCid && <p className="retailer-muted retailer-mono">CID PDF: {uploadedCid}</p>}
        <p className="retailer-muted">Mô tả chỉ để rà soát trước khi gửi; API hiện chưa có trường lưu mô tả. Nội dung cần lưu lâu dài phải có trong PDF. Giao dịch chỉ được gửi sau khi hash backend khớp tệp. Báo cáo không tự thu hồi lô.</p>
        <button className="retailer-button" disabled={busy || !!confirmed || !selected || !file || description.trim().length < 10}>{busy ? 'Đang xử lý…' : 'Ký và gửi reportIncident'}</button>
      </form>}</section>
      <section className="retailer-card"><h2>Lịch sử sự cố đã báo</h2>{!data.incidents.length ? <RetailerEmpty>Chưa có sự cố nào do ví này báo cáo.</RetailerEmpty> : <div className="retailer-list">{data.incidents.map((incident) => <div className="retailer-list-item" key={incident.id}><strong>#{incident.id} · {incident.code}</strong><span>{new Date(incident.at).toLocaleString('vi-VN')}</span><small className="retailer-mono">CID: {incident.cid}</small><small className="retailer-mono">SHA-256: {incident.hash}</small><small className="retailer-mono">Giao dịch: {incident.txHash}</small></div>)}</div>}</section>
    </div>}
  </div>
}
