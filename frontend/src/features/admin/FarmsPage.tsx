import { useCallback, useState } from 'react'
import { isAddress } from 'ethers'
import { Button, ErrorState, LoadingState, Modal, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { TxProgressModal, type TxStepDef } from '../../components/TxProgressModal'
import { useSession } from '../../app/session'
import { useStepFlow } from '../../hooks/useStepFlow'
import { sendTransaction, TxError } from '../../services/tx'
import { useAdminChain } from './hooks/useAdminChain'
import { readAdminFarms } from './services/adminChain'
import './styles/roles.css'
import './styles/farms.css'

const TX_STEPS: TxStepDef[] = [
  { label: 'Kiểm tra dữ liệu', description: 'Địa chỉ ví và farmId hợp lệ, đúng mạng.' },
  { label: 'Ký giao dịch', description: 'Xác nhận assignFarmer trong MetaMask.' },
  { label: 'Phát lên blockchain', description: 'Giao dịch đã gửi, chờ mạng xử lý.' },
  { label: 'Chờ biên nhận', description: 'Đợi block xác nhận giao dịch.' },
  { label: 'Đọc lại danh sách', description: 'Cập nhật farmId từ hợp đồng.' },
]

interface AssignForm {
  address: string
  farmId: string
}

interface AssignOperation {
  address: `0x${string}`
  farmId: string
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3 9.5h18M16.5 14.5h2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function FarmsPage() {
  const { session } = useSession()
  const { showToast } = useToast()
  const flow = useStepFlow()
  const loadFarms = useCallback((signal: AbortSignal) => readAdminFarms(signal), [])
  const { state, reload } = useAdminChain(loadFarms)

  const [form, setForm] = useState<AssignForm | null>(null)
  const [formError, setFormError] = useState('')
  const [progress, setProgress] = useState<AssignOperation | null>(null)

  const farms = state.kind === 'ready' ? state.data.farms : []

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  function openAssign(address = '', farmId = '') {
    setFormError('')
    setForm({ address, farmId })
  }

  function startAssign() {
    if (!form) return
    const address = form.address.trim()
    const farmId = form.farmId.trim()
    if (!isAddress(address)) {
      setFormError('Địa chỉ ví không hợp lệ (0x + 40 ký tự hex).')
      return
    }
    if (!farmId) {
      setFormError('farmId không được để trống.')
      return
    }
    setForm(null)
    setFormError('')
    void run({ address: address as `0x${string}`, farmId: farmId.toUpperCase() })
  }

  async function run(operation: AssignOperation) {
    setProgress(operation)
    flow.start()
    try {
      if (!session || session.source !== 'chain')
        throw new TxError('precondition', 'Cần đăng nhập bằng ví thật để ký giao dịch.')
      await sendTransaction(
        session.wallet.address,
        (contract) => contract.assignFarmer(operation.address, operation.farmId),
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
      showToast(`Đã gán ${operation.farmId} cho ${shortAddress(operation.address)}`, 'success')
    } catch (error) {
      if (error instanceof TxError) flow.fail(error.message, error.kind === 'rejected')
      else flow.fail('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
    }
  }

  function closeProgress() {
    setProgress(null)
    flow.reset()
  }

  return (
    <div className="farms-page">
      <PageHeader
        title="Farmer ↔ farmId"
        description="farmId đọc từ farmIdOf trên hợp đồng. assignFarmer vừa gán farmId vừa cấp vai trò Farmer; Farmer không thể tự sửa farmId khi tạo lô."
        actions={
          <Button type="button" onClick={() => openAssign()}>
            Gán farmId cho ví khác
          </Button>
        }
      />

      {state.kind === 'loading' && (
        <section className="roles-card">
          <LoadingState label="Đang đọc farmId từ blockchain…" />
        </section>
      )}

      {state.kind === 'error' && (
        <ErrorState
          title="Không đọc được danh sách Farmer"
          description={state.message}
          action={
            <Button type="button" onClick={reload}>
              Thử lại
            </Button>
          }
        />
      )}

      {state.kind === 'ready' && (
        <section className="roles-card" aria-label="Danh sách Farmer và farmId">
          <div className="roles-table-wrap">
            <table className="roles-table farms-table">
              <thead>
                <tr>
                  <th>Ví farmer</th>
                  <th>FarmID</th>
                  <th>Số lô</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {farms.map((row) => (
                  <tr key={row.address}>
                    <td>
                      <div className="farms-identity">
                        <span className="farms-address-line">
                          <WalletIcon />
                          <strong className="farms-name mono" title={row.address}>
                            {shortAddress(row.address)}
                          </strong>
                          <button
                            type="button"
                            className="farms-copy"
                            onClick={() => copyText(row.address, 'Đã sao chép địa chỉ ví')}
                            aria-label={`Sao chép địa chỉ ${row.address}`}
                            title={`Sao chép địa chỉ ví ${row.address}`}
                          >
                            <CopyIcon />
                          </button>
                        </span>
                        {row.activeFarmer ? (
                          <span className="farms-status">Farmer</span>
                        ) : (
                          <span className="farms-status revoked">Đã thu hồi quyền Farmer</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {row.farmId ? (
                        <span className="farms-farmid">{row.farmId}</span>
                      ) : (
                        <span className="farms-unassigned">Chưa gán</span>
                      )}
                    </td>
                    <td className="farms-batches">{row.batchCount}</td>
                    <td>
                      <Button
                        variant="secondary"
                        className="roles-action"
                        onClick={() => openAssign(row.address, row.farmId ?? '')}
                      >
                        {row.farmId ? 'Thay mapping' : 'Gán farmId'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {farms.length === 0 && (
                  <tr>
                    <td colSpan={4} className="roles-empty">
                      Chưa có Farmer nào trên chain. Dùng nút “Gán farmId cho ví khác”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={`farmId cho ${form?.address ? shortAddress(form.address) : 'ví'}`}
        className="roles-modal"
        footer={
          <div className="farms-modal-foot">
            <div className="farms-modal-actions">
              <Button variant="secondary" onClick={() => setForm(null)}>
                Hủy
              </Button>
              <Button onClick={startAssign}>Xác nhận giao dịch</Button>
            </div>
            {formError && <span className="farms-error">{formError}</span>}
          </div>
        }
      >
        <div className="farms-form">
          <label htmlFor="farmer-address">Địa chỉ ví Farmer</label>
          <input
            id="farmer-address"
            className="mono"
            value={form?.address ?? ''}
            onChange={(event) => {
              setForm((current) => ({ address: event.target.value, farmId: current?.farmId ?? '' }))
              setFormError('')
            }}
            placeholder="0x…"
            autoFocus
          />
          <label htmlFor="farm-id">farmId</label>
          <input
            id="farm-id"
            value={form?.farmId ?? ''}
            onChange={(event) => {
              setForm((current) => ({
                address: current?.address ?? '',
                farmId: event.target.value.toUpperCase(),
              }))
              setFormError('')
            }}
            placeholder="FARM-A"
          />
          <span className="farms-hint">Ví dụ FARM-A. farmId được ghi cố định vào lô lúc tạo.</span>
          <p className="farms-note">
            Thay farmId không đổi dữ liệu các lô đã tạo; lô mới dùng farmId mới. Gán farmId đồng
            thời cấp vai trò Farmer trên hợp đồng.
          </p>
        </div>
      </Modal>

      <TxProgressModal
        open={!!progress}
        onClose={closeProgress}
        title={`Gán ${progress?.farmId ?? ''} cho ${progress ? shortAddress(progress.address) : ''}`}
        method="assignFarmer(address, farmId)"
        summary={
          progress
            ? [
                {
                  label: 'Ví',
                  value: <span className="mono">{shortAddress(progress.address)}</span>,
                },
                { label: 'farmId', value: progress.farmId },
              ]
            : []
        }
        steps={TX_STEPS}
        flow={flow.state}
        successNote={
          progress
            ? `Đã gán ${progress.farmId}. Danh sách bên dưới đã đọc lại từ contract.`
            : undefined
        }
        onRetry={progress ? () => void run(progress) : undefined}
      />
    </div>
  )
}
