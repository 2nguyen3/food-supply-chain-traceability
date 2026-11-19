import { useState } from 'react'
import { TxProgressModal, type TxStepDef } from '../../components/TxProgressModal'
import { useStepFlow } from '../../hooks/useStepFlow'
import { sendTransaction, toTxError } from '../../services/tx'
import { RetailerBadge, RetailerEmpty, RetailerFlags, RetailerNotice } from './components'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import './styles/retailer.css'

const TX_STEPS: TxStepDef[] = [
  { label: 'Kiểm tra điều kiện', description: 'Lô phải thuộc Retailer và ở trạng thái Delivered.' },
  { label: 'Chờ ký ví', description: 'Xác nhận giao dịch trong MetaMask.' },
  { label: 'Phát giao dịch', description: 'Gửi markSold lên blockchain.' },
  { label: 'Chờ biên nhận', description: 'Đợi blockchain xác nhận.' },
  { label: 'Xác nhận', description: 'Lô chuyển sang Sold; chủ NFT không đổi.' },
]

export default function RetailerSalesPage() {
  const { data, address, error, loading, reload } = useRetailerSnapshot()
  const [busy, setBusy] = useState<string | null>(null)
  const [operation, setOperation] = useState<{ tokenId: string; code: string } | null>(null)
  const flow = useStepFlow()
  const eligibleBatches = data?.batches.filter((batch) => batch.lifecycle === 'Delivered' && !batch.recalled && !batch.expired && !batch.pendingRequestId) ?? []
  const markSold = async (tokenId: string, code: string, retry = false) => {
    if (!address || (!retry && !window.confirm(`Đánh dấu lô ${code} đã bán trên blockchain?`))) return
    setBusy(tokenId); setOperation({ tokenId, code }); flow.start()
    try {
      await sendTransaction(address, (contract) => contract.markSold(BigInt(tokenId)), {
        onSigning: () => flow.goTo(1),
        onBroadcast: (hash) => { flow.setTxHash(hash); flow.goTo(3) },
      })
      flow.goTo(4); flow.succeed(); reload()
    } catch (cause) { const failure = toTxError(cause); flow.fail(failure.message, failure.kind === 'rejected') }
    finally { setBusy(null) }
  }
  return <div className="retailer-page">
    <header><h1>Đánh dấu đã bán</h1><p>Chỉ lô Delivered thuộc Retailer, chưa hết hạn và chưa bị thu hồi mới đánh dấu được. Đây không phải đơn hàng hay thanh toán.</p></header>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {data && <section><h2>Lô có thể bán</h2>{!eligibleBatches.length ? <RetailerEmpty>Không có lô Delivered đủ điều kiện đánh dấu đã bán.</RetailerEmpty> : <div className="retailer-card retailer-table-wrap"><table className="retailer-table"><thead><tr><th>LÔ</th><th>TRẠNG THÁI</th><th>CHỦ NFT</th><th>HÀNH ĐỘNG</th></tr></thead><tbody>{eligibleBatches.map((batch) => {
      return <tr key={batch.tokenId}><td><strong>{batch.code}</strong><br /><span className="retailer-muted">NFT #{batch.tokenId}</span></td><td><RetailerBadge batch={batch} /><RetailerFlags batch={batch} /></td><td className="retailer-mono">{batch.owner.slice(0, 6)}…{batch.owner.slice(-4)}</td><td><button className="retailer-button" disabled={busy !== null} onClick={() => void markSold(batch.tokenId, batch.code)}>Đánh dấu đã bán</button></td></tr>
    })}</tbody></table></div>}</section>}
    <TxProgressModal
      open={!!operation}
      onClose={() => { setOperation(null); flow.reset() }}
      title={`Đánh dấu đã bán ${operation?.code ?? ''}`}
      method="markSold()"
      summary={operation ? [{ label: 'Lô', value: operation.code }, { label: 'Token ID', value: `#${operation.tokenId}` }, { label: 'Chủ sở hữu sau giao dịch', value: 'Retailer (không đổi)' }] : []}
      steps={TX_STEPS}
      flow={flow.state}
      successNote="Lô đã chuyển sang Sold sau khi có biên nhận. NFT vẫn thuộc Retailer."
      onRetry={!flow.state.txHash && operation ? () => void markSold(operation.tokenId, operation.code, true) : undefined}
    />
  </div>
}
