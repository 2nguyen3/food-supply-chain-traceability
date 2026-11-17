import { useCallback, useState } from 'react'
import { isAddress } from 'ethers'
import { Button, ErrorState, LoadingState, Modal, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { TxProgressModal, type TxStepDef } from '../../components/TxProgressModal'
import { useSession } from '../../app/session'
import type { Role } from '../../domain/types'
import { useStepFlow } from '../../hooks/useStepFlow'
import { roleHash } from '../../services/roles'
import { sendTransaction, TxError } from '../../services/tx'
import { ExplorerLink } from '../public/components/ExplorerLink'
import { useAdminChain } from './hooks/useAdminChain'
import { readAdminRoles, type AdminRoleChange, type AdminRoleHolder } from './services/adminChain'
import './styles/roles.css'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  farmer: 'Farmer',
  logistics: 'Logistics',
  retailer: 'Retailer',
}

const ROLE_ORDER: Role[] = ['admin', 'farmer', 'logistics', 'retailer']
const GRANTABLE_ROLES: Role[] = ['farmer', 'logistics', 'retailer']

const TX_STEPS: TxStepDef[] = [
  {
    label: 'Kiểm tra dữ liệu',
    description: 'Địa chỉ ví hợp lệ, đúng mạng và đúng tài khoản Admin.',
  },
  { label: 'Ký giao dịch', description: 'Xác nhận grantRole/revokeRole trong MetaMask.' },
  { label: 'Phát lên blockchain', description: 'Giao dịch đã gửi, chờ mạng xử lý.' },
  { label: 'Chờ biên nhận', description: 'Đợi block xác nhận giao dịch.' },
  { label: 'Đọc lại danh sách', description: 'Cập nhật role từ hợp đồng.' },
]

interface Operation {
  action: 'grant' | 'revoke'
  address: `0x${string}`
  role: Role
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
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

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6v5.5c0 4.5 2.9 7.6 7 9.5 4.1-1.9 7-5 7-9.5V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LeafIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 4c-8 0-14 3.5-14 10a6 6 0 0 0 6 6c6.5 0 8-6 8-16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M5 20c2.5-5 6-8 11-10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h11v10H3V6Zm11 3h4l3 3v4h-7V9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function StoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9V5h16v4M3 9h18l-1.5 3H4.5L3 9Zm1.5 3v7h15v-7M9 19v-4h6v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function RolePill({ role }: { role: Role }) {
  return (
    <span className={`roles-role ${role}`}>
      {role === 'admin' && <ShieldIcon />}
      {role === 'farmer' && <LeafIcon />}
      {role === 'logistics' && <TruckIcon />}
      {role === 'retailer' && <StoreIcon />}
      {ROLE_LABELS[role]}
    </span>
  )
}

function HistoryRow({ change }: { change: AdminRoleChange }) {
  return (
    <div className="roles-history-row">
      <span className={`roles-history-badge ${change.action === 'revoked' ? 'revoke' : 'grant'}`}>
        {change.action === 'revoked' ? 'Thu hồi' : 'Cấp role'}
      </span>
      <span className="roles-history-main">
        <strong>{ROLE_LABELS[change.role]}</strong>
        <span className="mono" title={change.address}>
          {shortAddress(change.address)}
        </span>
        <span className="roles-history-tx">
          <ExplorerLink kind="tx" value={change.txHash} />
        </span>
      </span>
      <span className="roles-history-time">{formatTime(change.at)}</span>
    </div>
  )
}

export function RolesPage() {
  const { session } = useSession()
  const { showToast } = useToast()
  const flow = useStepFlow()
  const loadRoles = useCallback((signal: AbortSignal) => readAdminRoles(signal), [])
  const { state, reload } = useAdminChain(loadRoles)

  const [query, setQuery] = useState('')
  const [grantTarget, setGrantTarget] = useState<{ address: string } | null>(null)
  const [grantRole, setGrantRole] = useState<Role>('farmer')
  const [grantError, setGrantError] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<AdminRoleHolder | null>(null)
  const [revokeRole, setRevokeRole] = useState<Role>('farmer')
  const [progress, setProgress] = useState<Operation | null>(null)

  const holders = state.kind === 'ready' ? state.data.holders : []
  const changes = state.kind === 'ready' ? state.data.changes : []

  const term = query.trim().toLowerCase()
  const filteredRows = holders.filter((holder) =>
    `${holder.address} ${holder.roles.map((role) => ROLE_LABELS[role]).join(' ')}`
      .toLowerCase()
      .includes(term),
  )

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  function openGrant(address = '') {
    setGrantRole('farmer')
    setGrantError('')
    setGrantTarget({ address })
  }

  function startGrant() {
    if (!grantTarget) return
    const address = grantTarget.address.trim()
    if (!isAddress(address)) {
      setGrantError('Địa chỉ ví không hợp lệ (0x + 40 ký tự hex).')
      return
    }
    const holder = holders.find((entry) => entry.address.toLowerCase() === address.toLowerCase())
    if (holder?.roles.includes(grantRole)) {
      setGrantError(`Ví này đã có role ${ROLE_LABELS[grantRole]}.`)
      return
    }
    setGrantTarget(null)
    setGrantError('')
    void run({ action: 'grant', address: address as `0x${string}`, role: grantRole })
  }

  function openRevoke(holder: AdminRoleHolder) {
    const options = holder.roles.filter((role) => role !== 'admin')
    if (!options.length) return
    setRevokeRole(options[0])
    setRevokeTarget(holder)
  }

  function startRevoke() {
    if (!revokeTarget) return
    const target = revokeTarget
    setRevokeTarget(null)
    void run({ action: 'revoke', address: target.address, role: revokeRole })
  }

  async function run(operation: Operation) {
    setProgress(operation)
    flow.start()
    try {
      if (!session || session.source !== 'chain')
        throw new TxError('precondition', 'Cần đăng nhập bằng ví thật để ký giao dịch.')
      await sendTransaction(
        session.wallet.address,
        (contract) =>
          operation.action === 'grant'
            ? contract.grantRole(roleHash(operation.role), operation.address)
            : contract.revokeRole(roleHash(operation.role), operation.address),
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
      showToast(
        `Đã ${operation.action === 'grant' ? 'cấp' : 'thu hồi'} role ${ROLE_LABELS[operation.role]} cho ${shortAddress(operation.address)}`,
        'success',
      )
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
    <div className="roles-page">
      <PageHeader
        title="Vai trò & quyền"
        description="Role đọc trực tiếp từ hợp đồng (hasRole). Cấp và thu hồi bằng grantRole/revokeRole, ký qua MetaMask. Người dùng không thể tự chọn role."
        actions={
          <Button type="button" onClick={() => openGrant()}>
            Cấp role cho ví khác
          </Button>
        }
      />

      {state.kind === 'loading' && (
        <section className="roles-card">
          <LoadingState label="Đang đọc vai trò từ blockchain…" />
        </section>
      )}

      {state.kind === 'error' && (
        <ErrorState
          title="Không đọc được danh sách vai trò"
          description={state.message}
          action={
            <Button type="button" onClick={reload}>
              Thử lại
            </Button>
          }
        />
      )}

      {state.kind === 'ready' && (
        <>
          <section className="roles-card" aria-label="Danh sách ví và vai trò">
            <div className="roles-search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tra cứu theo địa chỉ ví hoặc role..."
                aria-label="Tra cứu theo địa chỉ ví hoặc role"
              />
            </div>

            <div className="roles-table-wrap">
              <table className="roles-table">
                <thead>
                  <tr>
                    <th>Ví</th>
                    <th>Role</th>
                    <th>FarmID</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((holder) => {
                    const orderedRoles = ROLE_ORDER.filter((role) => holder.roles.includes(role))
                    const revocable = orderedRoles.filter((role) => role !== 'admin')
                    return (
                      <tr key={holder.address}>
                        <td>
                          <div className="roles-address">
                            <span className="roles-address-line">
                              <WalletIcon />
                              <span className="mono" title={holder.address}>
                                {shortAddress(holder.address)}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="roles-copy"
                              onClick={() => copyText(holder.address, 'Đã sao chép địa chỉ ví')}
                              aria-label={`Sao chép địa chỉ ${holder.address}`}
                              title="Sao chép địa chỉ ví"
                            >
                              <CopyIcon />
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="roles-role-group">
                            {orderedRoles.map((role) => (
                              <RolePill key={role} role={role} />
                            ))}
                          </div>
                        </td>
                        <td className="roles-farm">{holder.farmId ?? '—'}</td>
                        <td>
                          <div className="roles-actions">
                            <Button
                              variant="secondary"
                              className="roles-action"
                              onClick={() => openGrant(holder.address)}
                            >
                              Cấp role
                            </Button>
                            {revocable.length > 0 && (
                              <Button
                                variant="danger"
                                className="roles-action"
                                onClick={() => openRevoke(holder)}
                              >
                                Thu hồi role
                              </Button>
                            )}
                            {orderedRoles.includes('admin') && (
                              <span className="roles-locked">Không thể thu hồi Admin</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="roles-empty">
                        Không tìm thấy ví phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="roles-history-section" aria-labelledby="roles-history-title">
            <h2 id="roles-history-title">Lịch sử role</h2>
            <p className="roles-history-note">
              Dựng từ event RoleGranted/RoleRevoked trên chain; vẫn đúng sau khi tải lại trang.
            </p>
            {changes.length === 0 ? (
              <div className="roles-history-empty">
                <span className="roles-history-icon">
                  <ClockIcon />
                </span>
                <strong>Chưa có thay đổi role nào</strong>
              </div>
            ) : (
              <div className="roles-history-list">
                {changes.map((change) => (
                  <HistoryRow key={`${change.txHash}-${change.logIndex}`} change={change} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <Modal
        open={!!grantTarget}
        onClose={() => setGrantTarget(null)}
        title={`Cấp role cho ${grantTarget?.address ? shortAddress(grantTarget.address) : 'ví'}`}
        className="roles-modal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGrantTarget(null)}>
              Hủy
            </Button>
            <Button onClick={startGrant}>Xác nhận giao dịch</Button>
          </>
        }
      >
        <div className="roles-grant">
          <label htmlFor="grant-address">Địa chỉ ví</label>
          <input
            id="grant-address"
            className="mono"
            value={grantTarget?.address ?? ''}
            onChange={(event) => {
              setGrantTarget({ address: event.target.value })
              setGrantError('')
            }}
            placeholder="0x…"
            autoFocus
          />
          {grantError && <span className="roles-form-error">{grantError}</span>}
          <label htmlFor="grant-role">Role</label>
          <select
            id="grant-role"
            value={grantRole}
            onChange={(event) => {
              setGrantRole(event.target.value as Role)
              setGrantError('')
            }}
          >
            {GRANTABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <p>
            Farmer cần được gán farmId ở mục Farmer ↔ farmId trước khi tạo được lô. Mọi thay đổi đều
            phát event trên chain.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Thu hồi role?"
        className="roles-modal roles-modal-confirm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={startRevoke}>
              Thu hồi
            </Button>
          </>
        }
      >
        <div className="roles-grant">
          <p className="roles-confirm-text">
            Ví <span className="mono">{revokeTarget?.address}</span> sẽ mất role được chọn. Thao tác
            ghi tiếp theo của ví này sẽ bị hợp đồng chặn.
          </p>
          {revokeTarget && revokeTarget.roles.filter((role) => role !== 'admin').length > 1 ? (
            <>
              <label htmlFor="revoke-role">Role cần thu hồi</label>
              <select
                id="revoke-role"
                value={revokeRole}
                onChange={(event) => setRevokeRole(event.target.value as Role)}
              >
                {revokeTarget.roles
                  .filter((role) => role !== 'admin')
                  .map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
              </select>
            </>
          ) : (
            <p className="roles-confirm-role">
              Role: <RolePill role={revokeRole} />
            </p>
          )}
        </div>
      </Modal>

      <TxProgressModal
        open={!!progress}
        onClose={closeProgress}
        title={
          progress
            ? `${progress.action === 'grant' ? 'Cấp' : 'Thu hồi'} role ${ROLE_LABELS[progress.role]}`
            : 'Giao dịch role'
        }
        method={
          progress?.action === 'revoke' ? 'revokeRole(role, account)' : 'grantRole(role, account)'
        }
        summary={
          progress
            ? [
                {
                  label: 'Ví',
                  value: <span className="mono">{shortAddress(progress.address)}</span>,
                },
                { label: 'Role', value: ROLE_LABELS[progress.role] },
              ]
            : []
        }
        steps={TX_STEPS}
        flow={flow.state}
        successNote={
          progress
            ? `Đã ${progress.action === 'grant' ? 'cấp' : 'thu hồi'} role ${ROLE_LABELS[progress.role]}. Danh sách bên dưới đã đọc lại từ contract.`
            : undefined
        }
        onRetry={progress ? () => void run(progress) : undefined}
      />
    </div>
  )
}
