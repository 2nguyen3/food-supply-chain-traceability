import { useState } from 'react'
import { config } from '../../config/env'
import { toBytes32 } from '../../lib/hash'
import { inspectPublicChain } from '../public/services/publicChainReader'
import { sendTransaction, toTxError } from '../../services/tx'
import { RetailerEmpty, RetailerNotice } from './components'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import type { IncomingTransfer } from './services/retailerChain'
import './styles/retailer.css'

export default function RetailerIncomingPage() {
  const { data, address, error, loading, reload } = useRetailerSnapshot()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [verified, setVerified] = useState<Record<string, [string, string, string]>>({})
  const pending = data?.incoming.filter((request) => request.status === 'pending') ?? []
  const history = data?.incoming.filter((request) => request.status !== 'pending') ?? []
  const checkFiles = async (request: IncomingTransfer) => {
    if (!config.contractAddress) return
    setBusy(request.requestId); setMessage('Đang tải ba tệp gốc và đối chiếu SHA-256…')
    try {
      const result = await inspectPublicChain({ chainId: String(config.chainId), contractAddress: config.contractAddress, tokenId: request.tokenId }, new AbortController().signal)
      if (result.kind !== 'ok') throw new Error('Không tải đủ dữ liệu lô để xác minh. Chưa thể chấp nhận bàn giao.')
      const files = ['metadata.json', 'certificate.pdf', 'batch.jpg'].map((name) => result.batch.documents.find((document) => document.name === name))
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
    setBusy(request.requestId); setMessage('Đang chờ MetaMask và biên nhận giao dịch…')
    try {
      await sendTransaction(address, (contract) => action === 'accept'
        ? contract.acceptTransfer(BigInt(request.tokenId), BigInt(request.requestId), hashes)
        : contract.rejectTransfer(BigInt(request.tokenId), BigInt(request.requestId)))
      setVerified({}); setMessage(action === 'accept' ? `Đã nhận ${request.code} sau khi giao dịch được xác nhận.` : `Đã từ chối yêu cầu #${request.requestId}.`); reload()
    } catch (cause) { setMessage(toTxError(cause).message) }
    finally { setBusy(null) }
  }
  return <div className="retailer-page">
    <header><h1>Yêu cầu nhận lô</h1><p>Xác minh SHA-256 của metadata, chứng chỉ PDF và ảnh gốc trước khi chấp nhận. Quyền sở hữu chỉ đổi khi giao dịch được xác nhận.</p></header>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {message && <div className="retailer-card" role="status">{message}</div>}
    {data && <>
      <section><h2>Yêu cầu đang chờ</h2>{!pending.length ? <RetailerEmpty>Không có yêu cầu đang chờ. Khi Logistics gửi yêu cầu, yêu cầu sẽ hiện ở đây.</RetailerEmpty> : <div className="retailer-list">{pending.map((request) => <div className="retailer-card" key={request.requestId}><strong>{request.code} · NFT #{request.tokenId}</strong><p>Yêu cầu #{request.requestId} · Từ Logistics <span className="retailer-mono">{request.from.slice(0, 6)}…{request.from.slice(-4)}</span></p><p>{new Date(request.requestedAt).toLocaleString('vi-VN')}</p><div className="retailer-actions"><button className="retailer-button retailer-button-outline" disabled={busy !== null} onClick={() => void checkFiles(request)}>Xác minh 3 hồ sơ</button><button className="retailer-button" disabled={busy !== null || !verified[request.requestId]} onClick={() => void act(request, 'accept')}>Chấp nhận</button><button className="retailer-button retailer-button-outline" disabled={busy !== null} onClick={() => void act(request, 'reject')}>Từ chối</button></div></div>)}</div>}</section>
      <section><h2>Lịch sử xử lý</h2>{!history.length ? <RetailerEmpty>Chưa có lịch sử.</RetailerEmpty> : <div className="retailer-list">{history.map((request) => <div className="retailer-list-item" key={request.requestId}><strong>{request.code} · Yêu cầu #{request.requestId}</strong><span>{request.status === 'accepted' ? 'Đã chấp nhận' : request.status === 'rejected' ? 'Đã từ chối' : 'Đã hủy'}</span><small>{new Date(request.closedAt ?? request.requestedAt).toLocaleString('vi-VN')}</small></div>)}</div>}</section>
    </>}
  </div>
}
