import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { TxProgressModal, type TxStepDef } from '../../../components/TxProgressModal'
import { Button, Card, EmptyState, ErrorState, LoadingState, Modal, PageHeader } from '../../../components/ui'
import { config } from '../../../config/env'
import { useStepFlow } from '../../../hooks/useStepFlow'
import { listRoleMembers } from '../../../services/roles'
import { sendTransaction, TxError } from '../../../services/tx'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import { useFarmerSnapshot } from '../hooks/useFarmerSnapshot'
import type { FarmerBatch, FarmerTransfer, TransferStatus } from '../types'
import '../styles/farmer-transfers.css'

type Operation = { kind: 'request'; batch: FarmerBatch; to: `0x${string}` } | { kind: 'cancel'; batch: FarmerBatch; requestId: string }

const STATUS_LABELS: Record<TransferStatus, string> = {
  pending: 'Đang chờ',
  accepted: 'Đã nhận',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
}
const TX_STEPS: TxStepDef[] = [
  { label: 'Kiểm tra điều kiện', description: 'Kiểm tra Farmer, chủ sở hữu, mạng và yêu cầu đang chờ.' },
  { label: 'Chờ ký ví', description: 'Xác nhận giao dịch trong cửa sổ MetaMask.' },
  { label: 'Phát giao dịch', description: 'Giao dịch được gửi lên mạng.' },
  { label: 'Chờ biên nhận', description: 'Chờ mạng xác nhận giao dịch.' },
  { label: 'Cập nhật dữ liệu', description: 'Đọc lại trạng thái yêu cầu từ hợp đồng.' },
]

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

function formatTime(value?: string) {
  return value
    ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button type="button" onClick={() => void navigator.clipboard?.writeText(value).catch(() => {})} aria-label={label}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
      </svg>
    </button>
  )
}

function RecipientWalletChip({ transfer }: { transfer: FarmerTransfer }) {
  return (
    <span className="farmer-transfers-history-wallet">
      <span className="farmer-transfers-history-wallet-name">
        <FarmerOverviewIcon name="wallet" />
        <strong>{transfer.toLabel.split(' · ')[0]}</strong>
      </span>
      <span className="farmer-transfers-history-wallet-address">
        <span className="mono">{shortAddress(transfer.to)}</span>
        <CopyButton value={transfer.to} label="Sao chép địa chỉ ví người nhận" />
      </span>
    </span>
  )
}

export function FarmerTransfersPage() {
  const { session } = useSession()
  const { result, loading, reload } = useFarmerSnapshot()
  const [selectedBatch, setSelectedBatch] = useState<FarmerBatch | null>(null)
  const [recipients, setRecipients] = useState<{ status: 'loading' } | { status: 'ready'; list: `0x${string}`[] } | { status: 'error' }>({ status: 'loading' })
  const [recipient, setRecipient] = useState<`0x${string}` | ''>('')
  const [operation, setOperation] = useState<Operation | null>(null)
  const flow = useStepFlow()

  const snapshot = result?.kind === 'ready' ? result.snapshot : null
  const realWallet = session?.source === 'chain'
  const roleReady = !!session?.wallet.roles.includes('farmer')
  const networkReady = session?.wallet.chainId === config.chainId
  const ownBatches =
    snapshot?.batches.filter(
      (batch) => batch.ownedByMe && batch.lifecycle === 'Created' && !batch.pending && !batch.recalled && !batch.expired,
    ) ?? []
  const pending = snapshot?.batches.filter((batch) => batch.ownedByMe && batch.pending) ?? []
  const history = snapshot?.transfers ?? []
  const canAct = realWallet && roleReady && networkReady
  const batchPath = (code: string) => `/farmer/batches/${encodeURIComponent(code)}`

  useEffect(() => {
    if (!selectedBatch) return
    let active = true
    setRecipients({ status: 'loading' })
    listRoleMembers('logistics').then(
      (list) => active && setRecipients({ status: 'ready', list }),
      () => active && setRecipients({ status: 'error' }),
    )
    return () => {
      active = false
    }
  }, [selectedBatch])

  function openRequest(batch: FarmerBatch) {
    if (!canAct) return
    setRecipient('')
    setSelectedBatch(batch)
  }

  async function run(op: Operation) {
    if (!session) return
    setOperation(op)
    setSelectedBatch(null)
    flow.start()
    try {
      if (!canAct) throw new TxError('precondition', 'Cần đăng nhập bằng ví có vai trò Farmer, đúng mạng.')
      const tokenId = BigInt(op.batch.tokenId)
      await sendTransaction(
        session.wallet.address,
        (contract) => (op.kind === 'request' ? contract.requestTransfer(tokenId, op.to) : contract.cancelTransfer(tokenId, BigInt(op.requestId))),
        {
          onSigning: () => flow.goTo(1),
          onBroadcast: (hash) => {
            flow.setTxHash(hash)
            flow.goTo(3)
          },
        },
      )
      flow.goTo(4)
      reload()
      flow.succeed()
    } catch (error) {
      if (error instanceof TxError) flow.fail(error.message, error.kind === 'rejected')
      else flow.fail('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
    }
  }

  function closeProgress() {
    setOperation(null)
    flow.reset()
  }

  return (
    <div className="farmer-transfers-page">
      <PageHeader title="Chuyển giao cho Logistics" description="Gửi yêu cầu chuyển (requestTransfer) tới Logistics. Mỗi lô tối đa một yêu cầu đang hoạt động. Không có đặt hàng, giá hay thanh toán." />

      {loading ? (
        <Card><LoadingState label="Đang tải yêu cầu chuyển giao…" /></Card>
      ) : result?.kind === 'error' ? (
        <ErrorState title="Không thể đọc yêu cầu chuyển giao" description={result.message} action={<Button type="button" onClick={reload}>Thử lại</Button>} />
      ) : result?.kind === 'unassigned' ? (
        <Card className="farmer-transfers-feedback"><EmptyState title="Chưa được gán farmId" description="Admin cần gán farmId cho ví của bạn trên hợp đồng." /></Card>
      ) : result?.kind === 'noWallet' ? (
        <Card className="farmer-transfers-feedback"><EmptyState title="Cần đăng nhập bằng ví thật" description="Phiên xem giao diện không có dữ liệu trên blockchain. Hãy đăng xuất rồi kết nối MetaMask." /></Card>
      ) : (
        snapshot && (
          <>
            <section aria-labelledby="farmer-transfer-eligible-title">
              <h2 id="farmer-transfer-eligible-title" className="farmer-transfers-section-title">Lô có thể chuyển</h2>
              <Card className={ownBatches.length ? 'farmer-transfers-table-card' : 'farmer-transfers-feedback'}>
                {ownBatches.length ? (
                  <div className="farmer-transfers-table-wrap">
                    <table className="farmer-transfers-table">
                      <thead><tr><th>Lô</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
                      <tbody>
                        {ownBatches.map((batch) => (
                          <tr key={batch.tokenId}>
                            <td>
                              <Link to={batchPath(batch.code)} className="farmer-transfers-batch-link">{batch.code}</Link>
                              <span className="farmer-transfers-sub">#{batch.tokenId} · 1.000 kg</span>
                            </td>
                            <td><span className="farmer-transfers-lifecycle">Created · Đã tạo</span></td>
                            <td><Button type="button" disabled={!canAct} onClick={() => openRequest(batch)}>Yêu cầu chuyển cho Logistics</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="Không có lô có thể chuyển" description="Chỉ lô Created còn thuộc bạn, chưa có yêu cầu đang chờ, chưa hết hạn hoặc bị thu hồi mới gửi được yêu cầu cho Logistics." />
                )}
              </Card>
            </section>

            <section aria-labelledby="farmer-transfer-pending-title">
              <h2 id="farmer-transfer-pending-title" className="farmer-transfers-section-title">Yêu cầu đang chờ</h2>
              {pending.length ? (
                <div className="farmer-transfers-pending-list">
                  {pending.map((batch) => (
                    <Card className="farmer-transfers-pending" key={batch.tokenId}>
                      <div className="farmer-transfers-pending-head">
                        <strong className="mono">Yêu cầu #{batch.pending!.requestId}</strong>
                        <span className="farmer-transfers-status pending">Đang chờ</span>
                      </div>
                      <p>Chờ người nhận xử lý: chủ sở hữu NFT và vòng đời lô chưa đổi.</p>
                      <div className="farmer-transfers-pending-meta">
                        <span>Lô <Link to={batchPath(batch.code)}>{batch.code}</Link></span>
                        <span>Bạn → {batch.pending!.toLabel}</span>
                      </div>
                      <Button type="button" variant="secondary" disabled={!canAct} onClick={() => void run({ kind: 'cancel', batch, requestId: batch.pending!.requestId })}>
                        Hủy yêu cầu (cancelTransfer)
                      </Button>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="farmer-transfers-feedback"><EmptyState title="Không có yêu cầu đang chờ" /></Card>
              )}
            </section>

            <section aria-labelledby="farmer-transfer-history-title">
              <h2 id="farmer-transfer-history-title" className="farmer-transfers-section-title">Lịch sử yêu cầu</h2>
              <Card className="farmer-transfers-table-card">
                {history.length ? (
                  <div className="farmer-transfers-table-wrap">
                    <table className="farmer-transfers-table farmer-transfers-history">
                      <thead><tr><th>Request ID</th><th>Lô</th><th>Người nhận</th><th>Trạng thái</th><th>Tạo lúc</th><th>Đóng lúc</th></tr></thead>
                      <tbody>
                        {history.map((transfer) => (
                          <tr key={`${transfer.tokenId}-${transfer.id}`}>
                            <td className="mono">#{transfer.id}</td>
                            <td><Link to={batchPath(transfer.batchCode)}>{transfer.batchCode}</Link></td>
                            <td><RecipientWalletChip transfer={transfer} /></td>
                            <td><span className={`farmer-transfers-status ${transfer.status}`}>{STATUS_LABELS[transfer.status]}</span></td>
                            <td>{formatTime(transfer.requestedAt)}</td>
                            <td>{formatTime(transfer.closedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="Chưa có lịch sử" />
                )}
              </Card>
            </section>
            <p className="farmer-transfers-note">Chuyển trực tiếp ERC-721 (transferFrom) không được hỗ trợ. Chỉ dùng requestTransfer → acceptTransfer.</p>
          </>
        )
      )}

      <Modal
        open={!!selectedBatch}
        onClose={() => setSelectedBatch(null)}
        title={`Yêu cầu chuyển ${selectedBatch?.code ?? ''} cho Logistics`}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setSelectedBatch(null)}>Hủy</Button>
            <Button type="button" disabled={!recipient || !selectedBatch} onClick={() => selectedBatch && recipient && void run({ kind: 'request', batch: selectedBatch, to: recipient })}>
              Gửi yêu cầu
            </Button>
          </>
        }
      >
        <div className="farmer-transfers-select-dialog">
          <p>Tuyến cố định Farmer → Logistics → Retailer. Chủ sở hữu NFT vẫn là bạn cho tới khi người nhận xác minh 3 hash và chấp nhận.</p>
          <fieldset>
            <legend>Chọn người nhận (ví đang giữ vai trò Logistics)</legend>
            {recipients.status === 'loading' && <LoadingState label="Đang đọc danh sách ví Logistics từ hợp đồng…" />}
            {recipients.status === 'error' && <p className="field-error" role="alert">Không đọc được danh sách ví Logistics. Hãy đóng và thử lại.</p>}
            {recipients.status === 'ready' && recipients.list.length === 0 && (
              <p role="status">Chưa có ví nào được Admin cấp vai trò Logistics.</p>
            )}
            {recipients.status === 'ready' &&
              recipients.list.map((address) => (
                <div className="farmer-transfers-recipient" key={address}>
                  <label>
                    <input type="radio" name="transfer-recipient" checked={recipient === address} onChange={() => setRecipient(address)} />
                    <span><strong>Logistics</strong><small>Vai trò Logistics, đọc từ hợp đồng</small></span>
                  </label>
                  <span className="farmer-transfers-wallet">
                    <FarmerOverviewIcon name="wallet" />
                    <span className="mono">{shortAddress(address)}</span>
                    <CopyButton value={address} label="Sao chép địa chỉ ví Logistics" />
                  </span>
                </div>
              ))}
          </fieldset>
        </div>
      </Modal>

      <TxProgressModal
        open={!!operation}
        onClose={closeProgress}
        title={operation?.kind === 'cancel' ? `Hủy yêu cầu bàn giao ${operation.batch.code}` : `Yêu cầu chuyển ${operation?.batch.code ?? ''}`}
        method={operation?.kind === 'cancel' ? 'cancelTransfer()' : 'requestTransfer()'}
        summary={
          operation
            ? operation.kind === 'cancel'
              ? [
                  { label: 'requestId', value: <span className="mono">#{operation.requestId}</span> },
                  { label: 'Token', value: `#${operation.batch.tokenId}` },
                ]
              : [
                  { label: 'Lô', value: `${operation.batch.code} (#${operation.batch.tokenId})` },
                  { label: 'Người nhận', value: <span className="mono">{shortAddress(operation.to)}</span> },
                  { label: 'Khối lượng', value: '1.000 kg' },
                  { label: 'Chủ sở hữu sau bước này', value: 'Không đổi cho tới khi Logistics chấp nhận' },
                ]
            : []
        }
        steps={TX_STEPS}
        flow={flow.state}
        successNote={operation?.kind === 'cancel' ? 'Yêu cầu đã hủy. Chủ sở hữu NFT không đổi.' : 'Đã tạo yêu cầu bàn giao đang chờ. Chủ sở hữu NFT không đổi.'}
        onRetry={() => operation && void run(operation)}
      />
    </div>
  )
}
