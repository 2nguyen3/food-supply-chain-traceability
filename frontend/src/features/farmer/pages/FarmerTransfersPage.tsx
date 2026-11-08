import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { config } from '../../../config/env'
import { Button, Card, EmptyState, ErrorState, LoadingState, Modal, PageHeader } from '../../../components/ui'
import type { TransferRequest } from '../../../domain/types'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import type { FarmerOverviewBatch, PreviewFarmId } from '../mocks/farmerOverviewFixtures'
import { FARMER_TRANSFER_PREVIEW_LOGISTICS, FARMER_TRANSFER_PREVIEW_RECIPIENTS } from '../mocks/farmerTransferRecipients'
import { farmerOverviewReader, type FarmerOverviewResult } from '../services/farmerOverviewService'
import '../styles/farmer-transfers.css'

type ReadState = { key: string; result: FarmerOverviewResult }
type LocalTransfer = {
  id: string
  batchCode: string
  tokenId: string
  farmId: PreviewFarmId
  status: 'pending' | 'cancelled'
  requestedAt: string
  closedAt?: string
}
type Progress = {
  operation: 'request' | 'cancel'
  batchCode: string
  tokenId: string
  transferId?: string
  stage: number
}

const STATUS_LABELS: Record<TransferRequest['status'], string> = {
  pending: 'Đang chờ',
  accepted: 'Đã nhận',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
}
const PROGRESS_STEPS = [
  ['Kiểm tra điều kiện', 'Kiểm tra Farmer, farmId, chủ sở hữu và yêu cầu đang chờ.'],
  ['Chờ ký ví', 'Mô phỏng bước ký; không mở MetaMask.'],
  ['Phát giao dịch', 'Mô phỏng gửi yêu cầu; không có txHash Sepolia.'],
  ['Chờ biên nhận', 'Mô phỏng thời gian chờ xác nhận.'],
  ['Xác nhận', 'Chỉ cập nhật yêu cầu demo sau khi tiến trình hoàn tất.'],
] as const

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatLocalTime(value?: string) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

function RecipientWalletChip({ address }: { address?: string }) {
  return <span className="farmer-transfers-history-wallet">
    <span className="farmer-transfers-history-wallet-name"><FarmerOverviewIcon name="wallet" /><strong>Logistics</strong></span>
    <span className="farmer-transfers-history-wallet-address">
      <span className="mono">{address ? shortAddress(address) : 'Chưa có ví trong fixture'}</span>
      {address && <button type="button" onClick={() => void navigator.clipboard?.writeText(address).catch(() => {})} aria-label="Sao chép địa chỉ ví Logistics mô phỏng"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg></button>}
    </span>
  </span>
}

export function FarmerTransfersPage() {
  const { session } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const preview = import.meta.env.DEV && session?.source === 'development-preview'
  const previewHost = preview ? document.getElementById('development-preview') : null
  const [previewFarmId, setPreviewFarmId] = useState<PreviewFarmId | null>(() => {
    const value = searchParams.get('previewFarm')
    return value === 'FARM-B' ? 'FARM-B' : value === 'none' ? null : 'FARM-A'
  })
  const previewState = preview ? searchParams.get('previewState') : null
  const [attempt, setAttempt] = useState(0)
  const [readState, setReadState] = useState<ReadState | null>(null)
  const [localTransfers, setLocalTransfers] = useState<LocalTransfer[]>([])
  const [selectedBatchCode, setSelectedBatchCode] = useState<string | null>(null)
  const [recipientSelected, setRecipientSelected] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const runId = useRef(0)
  const requestCounter = useRef(0)
  const key = `${session?.wallet.address ?? 'none'}:${session?.source ?? 'none'}:${previewFarmId ?? 'none'}:${previewState ?? ''}:${attempt}`

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      farmerOverviewReader.read(session, preview ? previewFarmId : null, controller.signal).then(
        (result) => {
          if (controller.signal.aborted) return
          if (previewState === 'error') setReadState({ key, result: { kind: 'error' } })
          else if (previewState === 'empty' && result.kind === 'ready') {
            setReadState({ key, result: { ...result, snapshot: { ...result.snapshot, batches: [], transfers: [] } } })
          } else setReadState({ key, result })
        },
        () => { if (!controller.signal.aborted) setReadState({ key, result: { kind: 'error' } }) },
      )
    }, 220)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [session, preview, previewFarmId, previewState, key])

  useEffect(() => () => { runId.current += 1 }, [])

  const result = readState?.key === key ? readState.result : null
  const snapshot = result?.kind === 'ready' ? result.snapshot : null
  const ownBatches = snapshot?.batches.filter((batch) => batch.ownerFarmId === snapshot.farmId && batch.lifecycle === 'Created') ?? []
  const ownLocalTransfers = localTransfers.filter((transfer) => transfer.farmId === snapshot?.farmId && snapshot.batches.some((batch) => batch.code === transfer.batchCode))
  const pending = ownLocalTransfers.filter((transfer) => transfer.status === 'pending')
  const history = [
    ...ownLocalTransfers.map((transfer) => ({
      id: transfer.id,
      batchCode: transfer.batchCode,
      status: transfer.status as TransferRequest['status'],
      requestedAt: transfer.requestedAt,
      closedAt: transfer.closedAt,
      demo: true,
    })),
    ...(snapshot?.transfers.map((transfer) => ({
      id: '',
      batchCode: transfer.batchCode,
      status: transfer.status,
      requestedAt: transfer.requestedAt,
      closedAt: undefined as string | undefined,
      demo: true,
    })) ?? []),
  ]
  const selectedBatch = ownBatches.find((batch) => batch.code === selectedBatchCode)
  const roleReady = !!session?.wallet.roles.includes('farmer')
  const networkReady = session?.wallet.chainId === config.chainId
  const canRequest = !!selectedBatch && preview && roleReady && networkReady && recipientSelected && !pending.some((transfer) => transfer.batchCode === selectedBatch.code)
  const batchPath = (code: string) => `/farmer/batches/${encodeURIComponent(code)}${preview ? `?previewFarm=${previewFarmId ?? 'none'}` : ''}`

  function retry() {
    if (previewState === 'error') {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('previewState')
        return next
      })
    } else setAttempt((current) => current + 1)
  }

  function openRequest(batch: FarmerOverviewBatch) {
    if (!preview || !roleReady || !networkReady || !snapshot || batch.farmId !== snapshot.farmId || batch.ownerFarmId !== snapshot.farmId || batch.lifecycle !== 'Created' || pending.some((transfer) => transfer.batchCode === batch.code)) return
    setRecipientSelected(false)
    setSelectedBatchCode(batch.code)
  }

  function closeProgress() {
    runId.current += 1
    setProgress(null)
  }

  async function runPreview(operation: Progress['operation'], batchCode: string, tokenId: string, transferId?: string) {
    const currentRun = ++runId.current
    setSelectedBatchCode(null)
    setProgress({ operation, batchCode, tokenId, transferId, stage: 0 })
    for (let stage = 1; stage <= PROGRESS_STEPS.length; stage += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 420))
      if (runId.current !== currentRun) return
      setProgress({ operation, batchCode, tokenId, transferId, stage })
    }
    if (runId.current !== currentRun || !snapshot || !previewFarmId) return
    if (operation === 'request') {
      const id = `DEMO-REQ-${String(++requestCounter.current).padStart(3, '0')}`
      setLocalTransfers((current) => current.some((transfer) => transfer.farmId === snapshot.farmId && transfer.batchCode === batchCode && transfer.status === 'pending')
        ? current
        : [{ id, batchCode, tokenId, farmId: snapshot.farmId, status: 'pending', requestedAt: new Date().toISOString() }, ...current])
    } else {
      setLocalTransfers((current) => current.map((transfer) => transfer.id === transferId && transfer.farmId === snapshot.farmId && transfer.status === 'pending'
        ? { ...transfer, status: 'cancelled', closedAt: new Date().toISOString() }
        : transfer))
    }
  }

  function sendRequest() {
    if (!canRequest || !selectedBatch) return
    void runPreview('request', selectedBatch.code, selectedBatch.tokenId)
  }

  function cancelRequest(transfer: LocalTransfer) {
    if (!preview || !snapshot || !roleReady || transfer.farmId !== snapshot.farmId || transfer.status !== 'pending') return
    void runPreview('cancel', transfer.batchCode, transfer.tokenId, transfer.id)
  }

  return (
    <div className="farmer-transfers-page">
      <PageHeader title="Chuyển giao cho Logistics" description="Gửi yêu cầu chuyển (requestTransfer) tới Logistics. Mỗi lô tối đa một yêu cầu đang hoạt động. Không có đặt hàng, giá hay thanh toán." />

      {previewHost && createPortal(
        <div className="farmer-transfers-dev-field">
          <label htmlFor="farmer-transfers-preview-farm">Xem trước nông trại (mô phỏng)</label>
          <select id="farmer-transfers-preview-farm" value={previewFarmId ?? ''} onChange={(event) => setPreviewFarmId((event.target.value || null) as PreviewFarmId | null)}>
            <option value="FARM-A">Farmer A · FARM-A</option>
            <option value="FARM-B">Farmer B · FARM-B</option>
            <option value="">Chưa có farmId</option>
          </select>
          <small>Chỉ đổi dữ liệu mẫu, không đổi ví hoặc farmId thật.</small>
        </div>,
        previewHost,
      )}

      {!result && session ? <Card><LoadingState label="Đang tải yêu cầu chuyển giao…" /></Card>
        : result?.kind === 'error' ? <ErrorState title="Không thể đọc yêu cầu chuyển giao" description={previewState === 'error' ? 'Trạng thái lỗi mô phỏng; không phải lỗi RPC thật.' : 'Nguồn dữ liệu hiện chưa khả dụng.'} action={<Button type="button" onClick={retry}>Thử lại</Button>} />
          : result?.kind === 'unassigned' ? <Card className="farmer-transfers-feedback"><EmptyState title={preview ? 'Chưa được gán farmId' : 'Chưa có dữ liệu chuyển giao'} description={preview ? 'Chọn nông trại trong Development Preview để xem dữ liệu mô phỏng.' : 'Chưa có mapping farmId, ABI và dữ liệu hợp đồng để đọc hoặc gửi yêu cầu thật.'} /></Card>
            : snapshot && <>
              <section aria-labelledby="farmer-transfer-eligible-title">
                <h2 id="farmer-transfer-eligible-title" className="farmer-transfers-section-title">Lô có thể chuyển</h2>
                <Card className={ownBatches.length ? 'farmer-transfers-table-card' : 'farmer-transfers-feedback'}>
                  {ownBatches.length ? <div className="farmer-transfers-table-wrap"><table className="farmer-transfers-table"><thead><tr><th>Lô</th><th>Trạng thái</th><th>Yêu cầu</th><th>Hành động</th></tr></thead><tbody>
                    {ownBatches.map((batch) => {
                      const active = pending.find((transfer) => transfer.batchCode === batch.code)
                      return <tr key={batch.code}>
                        <td><Link to={batchPath(batch.code)} className="farmer-transfers-batch-link">{batch.code}</Link><span className="farmer-transfers-sub">#{batch.tokenId} · 1.000 kg</span></td>
                        <td><span className="farmer-transfers-lifecycle">Created · Đã tạo</span></td>
                        <td>{active ? <span className="farmer-transfers-request-ref">{active.id} · Đang chờ</span> : '—'}</td>
                        <td><Button type="button" disabled={!!active} onClick={() => openRequest(batch)}>Yêu cầu chuyển cho Logistics</Button></td>
                      </tr>
                    })}
                  </tbody></table></div> : <EmptyState title="Không có lô có thể chuyển" description="Chỉ lô Created còn thuộc Farmer hiện tại mới có thể gửi yêu cầu cho Logistics." />}
                </Card>
              </section>

              <section aria-labelledby="farmer-transfer-pending-title">
                <h2 id="farmer-transfer-pending-title" className="farmer-transfers-section-title">Yêu cầu đang chờ</h2>
                {pending.length ? <div className="farmer-transfers-pending-list">{pending.map((transfer) => <Card className="farmer-transfers-pending" key={transfer.id}>
                  <div className="farmer-transfers-pending-head"><strong className="mono">{transfer.id}</strong><span className="farmer-transfers-status pending">Đang chờ</span><small>Mô phỏng</small></div>
                  <p>Chờ xử lý: chủ sở hữu NFT và vòng đời lô chưa đổi.</p>
                  <div className="farmer-transfers-pending-meta"><span>Lô <Link to={batchPath(transfer.batchCode)}>{transfer.batchCode}</Link></span><span>{snapshot.farmerLabel} → Logistics</span><span>Tạo lúc {formatLocalTime(transfer.requestedAt)} · thời gian trình duyệt</span></div>
                  <Button type="button" variant="secondary" onClick={() => cancelRequest(transfer)}>Hủy yêu cầu (cancelTransfer)</Button>
                </Card>)}</div> : <Card className="farmer-transfers-feedback"><EmptyState title="Không có yêu cầu đang chờ" /></Card>}
              </section>

              <section aria-labelledby="farmer-transfer-history-title">
                <h2 id="farmer-transfer-history-title" className="farmer-transfers-section-title">Lịch sử yêu cầu</h2>
                <Card className="farmer-transfers-table-card">
                  {history.length ? <div className="farmer-transfers-table-wrap"><table className="farmer-transfers-table farmer-transfers-history"><thead><tr><th>Request ID</th><th>Lô</th><th>Người nhận</th><th>Trạng thái</th><th>Tạo lúc</th><th>Đóng lúc</th></tr></thead><tbody>
                    {history.map((transfer, index) => <tr key={`${transfer.batchCode}-${transfer.id || index}`}>
                      <td className="mono">{transfer.id || 'Chưa có request ID'}<span className="farmer-transfers-sub">Mô phỏng</span></td>
                      <td><Link to={batchPath(transfer.batchCode)}>{transfer.batchCode}</Link></td>
                      <td><RecipientWalletChip address={transfer.id ? FARMER_TRANSFER_PREVIEW_LOGISTICS.address : undefined} /></td>
                      <td><span className={`farmer-transfers-status ${transfer.status}`}>{STATUS_LABELS[transfer.status]}</span></td>
                      <td>{formatLocalTime(transfer.requestedAt)}</td><td>{formatLocalTime(transfer.closedAt)}</td>
                    </tr>)}
                  </tbody></table></div> : <EmptyState title="Chưa có lịch sử" />}
                </Card>
              </section>
              <p className="farmer-transfers-note">Chuyển trực tiếp ERC-721 (transferFrom) không được hỗ trợ. Chỉ dùng requestTransfer → acceptTransfer. Dữ liệu trên trang này là mô phỏng, chưa ghi lên Sepolia.</p>
            </>}

      <Modal open={!!selectedBatch} onClose={() => setSelectedBatchCode(null)} title={`Yêu cầu chuyển ${selectedBatch?.code ?? ''} cho Logistics`} footer={<><Button type="button" variant="secondary" onClick={() => setSelectedBatchCode(null)}>Hủy</Button><Button type="button" disabled={!canRequest} onClick={sendRequest}>Gửi yêu cầu</Button></>}>
        <div className="farmer-transfers-select-dialog">
          <p>Tuyến cố định Farmer → Logistics → Retailer. Chủ sở hữu NFT vẫn là bạn cho tới khi người nhận xác minh 3 hash và chấp nhận.</p>
          <fieldset><legend>Chọn người nhận</legend>
            {FARMER_TRANSFER_PREVIEW_RECIPIENTS.map((recipient) => <div className={`farmer-transfers-recipient ${recipient.eligible ? '' : 'disabled'}`} key={recipient.label}>
              <label><input type="radio" name="transfer-recipient" checked={recipient.eligible && recipientSelected} disabled={!recipient.eligible} onChange={() => setRecipientSelected(true)} /><span><strong>{recipient.label}</strong><small>{recipient.description}</small></span></label>
              <span className="farmer-transfers-wallet"><FarmerOverviewIcon name="wallet" /><span className="mono">{shortAddress(recipient.address)}</span><button type="button" onClick={() => void navigator.clipboard?.writeText(recipient.address).catch(() => {})} aria-label={`Sao chép địa chỉ ví mẫu ${recipient.label}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg></button></span>
            </div>)}
          </fieldset>
          <small>Địa chỉ và role trong danh sách chỉ là fixture development; chưa xác minh hasRole on-chain.</small>
        </div>
      </Modal>

      <Modal open={!!progress} onClose={closeProgress} title={progress?.operation === 'cancel' ? `Hủy yêu cầu ${progress.transferId ?? ''}` : `Yêu cầu chuyển ${progress?.batchCode ?? ''}`} footer={progress?.stage === PROGRESS_STEPS.length ? <Button type="button" onClick={closeProgress}>Hoàn tất</Button> : <span role="status">Đang xử lý yêu cầu mô phỏng…</span>}>
        {progress && <div className="farmer-transfers-progress">
          <p className="farmer-transfers-progress-mode">Tiến trình mô phỏng · không ký ví hoặc gửi giao dịch Sepolia</p>
          <span className="mono farmer-transfers-method">{progress.operation === 'cancel' ? 'cancelTransfer()' : 'requestTransfer()'}</span>
          <dl><div><dt>{progress.operation === 'cancel' ? 'requestId' : 'Lô'}</dt><dd className="mono">{progress.operation === 'cancel' ? progress.transferId : `${progress.batchCode} (#${progress.tokenId})`}</dd></div><div><dt>{progress.operation === 'cancel' ? 'Token' : 'Người nhận'}</dt><dd>{progress.operation === 'cancel' ? `#${progress.tokenId}` : 'Logistics · fixture mô phỏng'}</dd></div>{progress.operation === 'request' && <><div><dt>Khối lượng</dt><dd>1.000 kg</dd></div><div><dt>Chủ sở hữu sau bước này</dt><dd>Không đổi cho tới khi Logistics chấp nhận</dd></div></>}</dl>
          <ol>{PROGRESS_STEPS.map(([label, description], index) => <li key={label} className={index < progress.stage ? 'complete' : index === progress.stage ? 'active' : ''}><span className="farmer-transfers-progress-mark">{index < progress.stage ? <FarmerOverviewIcon name="check" /> : index === progress.stage ? <span className="farmer-transfers-spinner" /> : index + 1}</span><span><strong>{label}</strong><small>{description}</small></span></li>)}</ol>
          {progress.stage === PROGRESS_STEPS.length && <p className="farmer-transfers-progress-success">{progress.operation === 'cancel' ? 'Yêu cầu demo đã hủy. Chủ sở hữu NFT không đổi.' : 'Đã tạo yêu cầu demo đang chờ. Chủ sở hữu NFT không đổi.'}</p>}
        </div>}
      </Modal>
    </div>
  )
}
