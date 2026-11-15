import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { config } from '../../config/env'
import type { DemoBatch } from '../public/mocks/traceDetailFixtures'
import { TraceDocumentsPanel, TraceJourneyPanel, TraceNFTPanel, TraceTemperaturePanel, TraceTechnicalPanel } from '../public/components/TracePanels'
import { TraceQRCode } from '../public/components/TraceQRCode'
import { inspectPublicChain, type PublicReadStatus } from '../public/services/publicChainReader'
import { RetailerPrivateDocuments } from './RetailerPrivateDocuments'
import { RetailerBadge, RetailerEmpty, RetailerFlags, RetailerNotice } from './components'
import { useRetailerSnapshot } from './hooks/useRetailerSnapshot'
import '../public/styles/trace-detail.css'
import '../farmer/styles/farmer-batch-detail.css'
import './styles/retailer.css'

type Tab = 'overview' | 'public' | 'private' | 'temperature' | 'journey' | 'qr'
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' }, { id: 'public', label: 'Tài liệu công khai' },
  { id: 'private', label: 'Tài liệu riêng' }, { id: 'temperature', label: 'Nhiệt độ' },
  { id: 'journey', label: 'Hành trình & NFT' }, { id: 'qr', label: 'QR' },
]

export default function RetailerBatchDetailPage() {
  const { code } = useParams<{ code: string }>()
  const { data, error, loading, reload } = useRetailerSnapshot()
  const owned = data?.batches.find((batch) => batch.code === code)
  const tokenId = owned?.tokenId
  const [tab, setTab] = useState<Tab>('overview')
  const [read, setRead] = useState<{ tokenId: string; result: PublicReadStatus } | null>(null)
  const [readError, setReadError] = useState('')
  useEffect(() => {
    if (!tokenId || !config.contractAddress) return
    const controller = new AbortController()
    inspectPublicChain({ chainId: String(config.chainId), contractAddress: config.contractAddress, tokenId }, controller.signal).then(
      (result) => { if (!controller.signal.aborted) setRead({ tokenId, result }) },
      () => { if (!controller.signal.aborted) setReadError('Không tải được hồ sơ công khai của lô. Hãy thử tải lại trang.') },
    )
    return () => controller.abort()
  }, [tokenId])
  const result = read && read.tokenId === tokenId ? read.result : undefined
  const batch: DemoBatch | undefined = result?.kind === 'ok' ? result.batch : undefined

  return <div className="retailer-page">
    <Link className="retailer-batch-link" to="/retailer/batches">← Lô quản lý</Link>
    <RetailerNotice loading={loading} error={error} reload={reload} />
    {data && !owned && <RetailerEmpty>Không tìm thấy lô này trong các NFT ví Retailer hiện sở hữu.</RetailerEmpty>}
    {owned && <>
      <header><h1>{owned.code}</h1><p>Token ID #{owned.tokenId} · {owned.farmId} / {owned.harvestGroupId} · 1.000 kg · 1 NFT</p><RetailerBadge batch={owned} /><RetailerFlags batch={owned} /></header>
      <div className="retailer-actions">
        {config.contractAddress && <Link className="retailer-button retailer-button-outline" to={`/trace/${config.chainId}/${config.contractAddress}/${owned.tokenId}`}>Mở trang công khai</Link>}
      </div>
      <div className="retailer-detail-tabs" role="tablist" aria-label="Thông tin lô">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
      <div role="tabpanel" className="retailer-card">
        {tab === 'overview' && <><dl className="retailer-detail-grid">
          <div><dt>Mã lô</dt><dd>{owned.code}</dd></div><div><dt>Token ID</dt><dd>#{owned.tokenId}</dd></div>
          <div><dt>Farm ID</dt><dd>{owned.farmId}</dd></div><div><dt>Nhóm thu hoạch</dt><dd>{owned.harvestGroupId}</dd></div>
          <div><dt>Trạng thái</dt><dd>{owned.lifecycle}</dd></div><div><dt>Chủ sở hữu NFT</dt><dd className="retailer-mono">{owned.owner}</dd></div>
          <div><dt>Hạn sử dụng</dt><dd>{new Date(owned.expiryDate).toLocaleString('vi-VN')}</dd></div>
        </dl><div className="retailer-detail-sale">
          {owned.lifecycle === 'Delivered' && !owned.recalled && !owned.expired && !owned.pendingRequestId
            ? <Link className="retailer-button" to="/retailer/sales">Đánh dấu đã bán</Link>
            : <><button className="retailer-button" disabled>Đánh dấu đã bán</button><span className="retailer-muted">{owned.recalled ? 'Lô đã thu hồi.' : owned.expired ? 'Lô đã hết hạn.' : owned.lifecycle === 'Sold' ? 'Lô đã bán.' : owned.pendingRequestId ? 'Lô đang có yêu cầu bàn giao.' : 'Chỉ lô Delivered mới có thể bán.'}</span></>}
        </div></>}
        {tab === 'private' && <RetailerPrivateDocuments tokenId={owned.tokenId} />}
        {tab !== 'overview' && tab !== 'private' && !batch && <RetailerEmpty>{readError || (result ? 'Hồ sơ chi tiết chưa khả dụng. Vui lòng kiểm tra RPC và IPFS.' : 'Đang đọc hồ sơ từ blockchain và IPFS…')}</RetailerEmpty>}
        {batch && tab === 'public' && <TraceDocumentsPanel batch={batch} />}
        {batch && tab === 'temperature' && <TraceTemperaturePanel batch={batch} />}
        {batch && tab === 'journey' && <div className="retailer-grid"><section><h2>Hành trình lô</h2><TraceJourneyPanel events={batch.events} live /></section><section><h2>Lịch sử NFT</h2><TraceNFTPanel ownership={batch.ownership} wallets={batch.wallets} /></section></div>}
        {batch && tab === 'qr' && config.contractAddress && <><TraceQRCode code={owned.code} path={`/trace/${config.chainId}/${config.contractAddress}/${owned.tokenId}`} /><TraceTechnicalPanel batch={batch} /></>}
      </div>
    </>}
  </div>
}
