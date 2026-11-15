import { useState } from 'react'
import { sendTransaction, toTxError } from '../../services/tx'
import { RetailerBadge, RetailerEmpty, RetailerFlags, RetailerNotice } from './components'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import './styles/retailer.css'

export default function RetailerSalesPage() {
  const { data, address, error, loading, reload } = useRetailerSnapshot()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const markSold = async (tokenId: string, code: string) => {
    if (!address || !window.confirm(`Đánh dấu lô ${code} đã bán trên blockchain?`)) return
    setBusy(tokenId); setMessage('Đang chờ ký và xác nhận giao dịch…')
    try {
      await sendTransaction(address, (contract) => contract.markSold(BigInt(tokenId)))
      setMessage(`Lô ${code} đã chuyển sang Sold sau khi giao dịch được xác nhận. NFT vẫn thuộc Retailer.`)
      reload()
    } catch (cause) { setMessage(toTxError(cause).message) }
    finally { setBusy(null) }
  }
  return <div className="retailer-page">
    <header><h1>Đánh dấu đã bán</h1><p>Chỉ lô Delivered thuộc Retailer, chưa hết hạn và chưa bị thu hồi mới đánh dấu được. Đây không phải đơn hàng hay thanh toán.</p></header>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {message && <div className="retailer-card" role="status">{message}</div>}
    {data && (!data.batches.length ? <RetailerEmpty>Chưa có lô nào thuộc ví Retailer.</RetailerEmpty> : <div className="retailer-card retailer-table-wrap"><table className="retailer-table"><thead><tr><th>LÔ</th><th>TRẠNG THÁI</th><th>CHỦ NFT</th><th>HÀNH ĐỘNG</th></tr></thead><tbody>{data.batches.map((batch) => {
      const eligible = batch.lifecycle === 'Delivered' && !batch.recalled && !batch.expired && !batch.pendingRequestId
      const reason = batch.lifecycle === 'Sold' ? 'Lô đã bán.' : batch.recalled ? 'Lô đã thu hồi.' : batch.expired ? 'Lô đã hết hạn.' : batch.lifecycle !== 'Delivered' ? 'Lô chưa ở trạng thái Delivered.' : batch.pendingRequestId ? 'Lô đang có yêu cầu bàn giao.' : ''
      return <tr key={batch.tokenId}><td><strong>{batch.code}</strong><br /><span className="retailer-muted">NFT #{batch.tokenId}</span></td><td><RetailerBadge batch={batch} /><RetailerFlags batch={batch} /></td><td className="retailer-mono">{batch.owner.slice(0, 6)}…{batch.owner.slice(-4)}</td><td><button className="retailer-button" disabled={!eligible || busy !== null} onClick={() => void markSold(batch.tokenId, batch.code)}>Đánh dấu đã bán</button>{reason && <div className="retailer-muted">{reason}</div>}</td></tr>
    })}</tbody></table></div>)}
  </div>
}
