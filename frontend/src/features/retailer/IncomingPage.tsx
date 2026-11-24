import { useState } from 'react'
import { TxProgressModal, type TxStepDef } from '../../components/TxProgressModal'
import { config } from '../../config/env'
import { useStepFlow } from '../../hooks/useStepFlow'
import { toBytes32 } from '../../lib/hash'
import { inspectPublicChain } from '../public/services/publicChainReader'
import { sendTransaction, toTxError } from '../../services/tx'
import { RetailerEmpty, RetailerNotice } from './components'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import type { IncomingTransfer } from './services/retailerChain'
import './styles/retailer.css'

const TX_STEPS: TxStepDef[] = [
  { label: 'Kiểm tra điều kiện', description: 'Kiểm tra yêu cầu và hồ sơ trước khi gửi.' },
  { label: 'Chờ ký ví', description: 'Xác nhận giao dịch trong MetaMask.' },
  { label: 'Phát giao dịch', description: 'Gửi giao dịch lên mạng đang kết nối.' },
  { label: 'Chờ biên nhận', description: 'Đợi blockchain xác nhận giao dịch.' },
  { label: 'Xác nhận', description: 'Cập nhật trạng thái sau biên nhận.' },
]

export default function RetailerIncomingPage() {
  const { data, address, error, loading, reload } = useRetailerSnapshot()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [verified, setVerified] = useState<Record<string, [string, string, string]>>({})
  const [fileChecks, setFileChecks] = useState<Record<string, { name: string; status: string }[]>>({})
  const [operation, setOperation] = useState<{ request: IncomingTransfer; action: 'accept' | 'reject' } | null>(null)
  const flow = useStepFlow()
  const pending = data?.incoming.filter((request) => request.status === 'pending') ?? []
  const history = data?.incoming.filter((request) => request.status !== 'pending') ?? []
  const checkFiles = async (request: IncomingTransfer) => {
    if (!config.contractAddress) return
    setBusy(request.requestId); setMessage('Đang tải ba tệp gốc và đối chiếu SHA-256…')
    setVerified((value) => { const next = { ...value }; delete next[request.requestId]; return next })
    setFileChecks((value) => { const next = { ...value }; delete next[request.requestId]; return next })
    try {
      const result = await inspectPublicChain({ chainId: String(config.chainId), contractAddress: config.contractAddress, tokenId: request.tokenId }, new AbortController().signal)
      if (result.kind !== 'ok') throw new Error('Không tải đủ dữ liệu lô để xác minh. Chưa thể chấp nhận bàn giao.')
      const kinds = ['metadata', 'certificate', 'image'] as const
      const files = kinds.map((kind) => result.batch.documents.find((document) => document.kind === kind))
      setFileChecks((value) => ({ ...value, [request.requestId]: ['metadata.json', 'certificate.pdf', 'batch.jpg'].map((name, index) => ({
        name: files[index]?.name ?? name,
        status: files[index]?.verified === 'match' ? 'SHA-256 khớp blockchain' : files[index]?.verified === 'mismatch' ? 'SHA-256 không khớp' : 'Không tải được tệp hoặc thiếu hash',
      })) }))
      if (files.some((file) => file?.verified !== 'match' || !file.sha256)) throw new Error('Có tệp thiếu hoặc hash SHA-256 không khớp blockchain. Chưa thể chấp nhận.')
      setVerified((value) => ({ ...value, [request.requestId]: files.map((file) => toBytes32(file!.sha256!)) as [string, string, string] }))
      setMessage(`Đã đối chiếu byte gốc của 3 tệp thuộc ${request.code}. Có thể chấp nhận yêu cầu #${request.requestId}.`)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không thể xác minh hồ sơ.') }
    finally { setBusy(null) }
  }
  const act = async (request: IncomingTransfer, action: 'accept' | 'reject') => {
    if (!address) return
    if (action === 'reject' && !window.confirm(`Từ chối yêu cầu nhận ${request.code}?`)) return
    const hashes = verified[request.requestId]
    if (action === 'accept' && !hashes) { setMessage('Hãy xác minh ba tệp công khai trước khi chấp nhận.'); return }
    setBusy(request.requestId); setMessage('')
    setOperation({ request, action }); flow.start()
    try {
      await sendTransaction(address, (contract) => action === 'accept'
        ? contract.acceptTransfer(BigInt(request.tokenId), BigInt(request.requestId), hashes)
        : contract.rejectTransfer(BigInt(request.tokenId), BigInt(request.requestId)), {
        onSigning: () => flow.goTo(1),
        onBroadcast: (hash) => { flow.setTxHash(hash); flow.goTo(3) },
      })
      flow.goTo(4); flow.succeed()
      setVerified({}); reload()
    } catch (cause) { const failure = toTxError(cause); flow.fail(failure.message, failure.kind === 'rejected') }
    finally { setBusy(null) }
  }
  return <div className="retailer-page">
    <header><h1>Yêu cầu nhận lô</h1><p>Xác minh SHA-256 của metadata, chứng chỉ PDF và ảnh gốc trước khi chấp nhận. Quyền sở hữu chỉ đổi khi giao dịch được xác nhận.</p></header>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {message && <div className="retailer-card" role="status">{message}</div>}
    {data && <>
      <section><h2>Yêu cầu đang chờ</h2>{!pending.length ? <RetailerEmpty>Không có yêu cầu đang chờ. Khi Logistics gửi yêu cầu, yêu cầu sẽ hiện ở đây.</RetailerEmpty> : <div className="retailer-list">{pending.map((request) => <div className="retailer-card" key={request.requestId}><strong>{request.code} · NFT #{request.tokenId}</strong><p>Yêu cầu #{request.requestId} · Từ Logistics <span className="retailer-mono">{request.from.slice(0, 6)}…{request.from.slice(-4)}</span></p><p>{new Date(request.requestedAt).toLocaleString('vi-VN')}</p>{fileChecks[request.requestId] && <ul className="retailer-file-checks">{fileChecks[request.requestId].map((check) => <li key={check.name}><strong>{check.name}</strong><span className={check.status === 'SHA-256 khớp blockchain' ? 'retailer-success' : 'retailer-error'}>{check.status}</span></li>)}</ul>}<div className="retailer-actions"><button className="retailer-button retailer-button-outline" disabled={busy !== null} onClick={() => void checkFiles(request)}>Xác minh 3 hồ sơ</button><button className="retailer-button" disabled={busy !== null || !verified[request.requestId]} onClick={() => void act(request, 'accept')}>Chấp nhận</button><button className="retailer-button retailer-button-outline" disabled={busy !== null} onClick={() => void act(request, 'reject')}>Từ chối</button></div></div>)}</div>}</section>
      <section><h2>Lịch sử xử lý</h2>{!history.length ? <RetailerEmpty>Chưa có lịch sử.</RetailerEmpty> : <div className="retailer-list">{history.map((request) => <div className="retailer-list-item" key={request.requestId}><strong>{request.code} · Yêu cầu #{request.requestId}</strong><span>{request.status === 'accepted' ? 'Đã chấp nhận' : request.status === 'rejected' ? 'Đã từ chối' : 'Đã hủy'}</span><small>{new Date(request.closedAt ?? request.requestedAt).toLocaleString('vi-VN')}</small></div>)}</div>}</section>
    </>}
    <TxProgressModal
      open={!!operation}
      onClose={() => { setOperation(null); flow.reset() }}
      title={`${operation?.action === 'accept' ? 'Nhận' : 'Từ chối'} lô ${operation?.request.code ?? ''}`}
      method={operation?.action === 'accept' ? 'acceptTransfer()' : 'rejectTransfer()'}
      summary={operation ? [
        { label: 'Lô', value: operation.request.code },
        { label: 'Token ID', value: `#${operation.request.tokenId}` },
        { label: 'Request ID', value: `#${operation.request.requestId}` },
        { label: 'Chủ NFT sau khi nhận', value: operation.action === 'accept' ? 'Retailer, sau biên nhận xác nhận' : 'Không đổi' },
      ] : []}
      steps={TX_STEPS}
      flow={flow.state}
      successNote={operation?.action === 'accept' ? 'Đã nhận lô sau khi giao dịch được xác nhận.' : 'Đã từ chối yêu cầu. Quyền sở hữu NFT không đổi.'}
      onRetry={!flow.state.txHash && operation ? () => void act(operation.request, operation.action) : undefined}
    />
  </div>
}
