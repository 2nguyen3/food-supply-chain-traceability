import { Link } from 'react-router-dom'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import { RetailerBadge, RetailerBatchLink, RetailerEmpty, RetailerFlags, RetailerNotice } from './components'
import './styles/retailer.css'

export default function RetailerOverviewPage() {
  const { data, address, error, loading, reload } = useRetailerSnapshot()
  const pending = data?.incoming.filter((request) => request.status === 'pending').length ?? 0
  const delivered = data?.batches.filter((batch) => batch.lifecycle === 'Delivered').length ?? 0
  const sold = data?.batches.filter((batch) => batch.lifecycle === 'Sold').length ?? 0
  return <div className="retailer-page">
    <header><h1>Xin chào, Retailer{address ? ` · ${address.slice(0, 6)}…${address.slice(-4)}` : ''}</h1><p>Xác minh và nhận lô từ Logistics, đánh dấu đã bán và báo cáo sự cố.</p></header>
    <div className="retailer-actions"><Link className="retailer-button" to="/retailer/incidents/new">Báo cáo sự cố</Link></div>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {data && <>
      <div className="retailer-grid">
        {[['Chờ xác minh/nhận', pending], ['Đã giao (Delivered)', delivered], ['Đã bán (Sold)', sold], ['Sự cố đã báo', data.incidents.length]].map(([label, count]) => <div className="retailer-card retailer-kpi" key={label}><span>{label}</span><strong>{count}</strong></div>)}
      </div>
      <section><h2>Lô của tôi</h2>{data.batches.length ? <div className="retailer-grid retailer-grid-3">{data.batches.slice(0, 6).map((batch) => <div className="retailer-card" key={batch.tokenId}><RetailerBatchLink batch={batch} /><p>#{batch.tokenId} · {batch.farmId} · {batch.harvestGroupId}</p><p><RetailerBadge batch={batch} /><RetailerFlags batch={batch} /></p></div>)}</div> : <RetailerEmpty>Chưa có lô NFT nào thuộc ví Retailer này.</RetailerEmpty>}</section>
    </>}
  </div>
}
