import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RetailerBadge, RetailerBatchLink, RetailerEmpty, RetailerFlags, RetailerNotice } from './components'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import './styles/retailer.css'

export default function RetailerBatchesPage() {
  const { data, error, loading, reload } = useRetailerSnapshot()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [direct, setDirect] = useState('')
  const [directError, setDirectError] = useState('')
  const filtered = data?.batches.filter((batch) => batch.code.toLowerCase().includes(search.trim().toLowerCase()) && (status === 'ALL' || (status === 'Recalled' ? batch.recalled : batch.lifecycle === status))) ?? []
  const openDirect = () => {
    const batch = data?.batches.find((item) => item.code.toLowerCase() === direct.trim().toLowerCase())
    if (batch) { setDirectError(''); navigate(`/retailer/batches/${encodeURIComponent(batch.code)}`) }
    else setDirectError('Không tìm thấy lô thuộc ví Retailer hiện tại.')
  }
  return <div className="retailer-page">
    <header><h1>Lô quản lý</h1><p>Các lô NFT Retailer đang sở hữu. Lô đã bán vẫn thuộc Retailer.</p></header>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {data && <>
      <div className="retailer-toolbar">
        <input aria-label="Tìm theo mã lô" placeholder="Tìm theo mã lô..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="Created">Created</option><option value="InTransit">InTransit</option><option value="Delivered">Delivered</option><option value="Sold">Sold</option><option value="Recalled">Đã thu hồi</option></select>
        <span>{filtered.length} lô</span>
        <input aria-label="Mở lô theo mã" placeholder="Mở lô theo mã (chỉ đọc)" value={direct} onChange={(event) => { setDirect(event.target.value); setDirectError('') }} onKeyDown={(event) => { if (event.key === 'Enter') openDirect() }} />
        <button className="retailer-button retailer-button-outline" onClick={openDirect}>Mở</button>
      </div>
      {directError && <p className="retailer-error" role="alert">{directError}</p>}
      {!filtered.length ? <RetailerEmpty>{data.batches.length ? 'Không có lô phù hợp bộ lọc.' : 'Chưa có lô NFT nào thuộc ví Retailer này.'}</RetailerEmpty> : <div className="retailer-card retailer-table-wrap"><table className="retailer-table"><thead><tr><th>MÃ LÔ</th><th>TOKEN</th><th>FARM / NHÓM</th><th>CHỦ SỞ HỮU NFT</th><th>TRẠNG THÁI</th><th>HẠN DÙNG</th></tr></thead><tbody>{filtered.map((batch) => <tr key={batch.tokenId}><td><RetailerBatchLink batch={batch} /></td><td className="retailer-mono">#{batch.tokenId}</td><td>{batch.farmId} · {batch.harvestGroupId}</td><td className="retailer-mono">{batch.owner.slice(0, 6)}…{batch.owner.slice(-4)}</td><td><RetailerBadge batch={batch} /><RetailerFlags batch={batch} /></td><td>{new Date(batch.expiryDate).toLocaleDateString('vi-VN')}</td></tr>)}</tbody></table></div>}
    </>}
  </div>
}
