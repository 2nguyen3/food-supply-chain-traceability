import { useState } from 'react'
import { Button, Modal, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import type { Role } from '../../domain/types'
import { recordRoleChange, type RoleHistoryEntry } from './roleStore'
import { useRoleHistory } from './roleStore'
import { TxProgressModal } from './TxProgressModal'
import './styles/roles.css'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  farmer: 'Farmer',
  logistics: 'Logistics',
  retailer: 'Retailer',
}

const GRANTABLE_ROLES: Role[] = ['farmer', 'logistics', 'retailer']

const TX_HASH = '0xe1ae09f7a3c4d5b6e7f8091a2b3c4f3d89d'

interface RoleRow {
  id: string
  name: string
  address: `0x${string}`
  role: Role | null
  farmId: string | null
  note?: string
  admin?: boolean
}

const INITIAL_ROWS: RoleRow[] = [
  {
    id: 'admin',
    name: 'Admin',
    address: '0xAD00000000000000000000000000000000000001',
    role: 'admin',
    farmId: null,
    admin: true,
  },
  {
    id: 'farmer-a',
    name: 'Farmer A',
    address: '0xFA00000000000000000000000000000000000001',
    role: 'farmer',
    farmId: 'FARM-A',
  },
  {
    id: 'farmer-b',
    name: 'Farmer B',
    address: '0xFB00000000000000000000000000000000000001',
    role: 'farmer',
    farmId: 'FARM-B',
  },
  {
    id: 'logistics',
    name: 'Logistics',
    address: '0x1000000000000000000000000000000000000001',
    role: 'logistics',
    farmId: null,
  },
  {
    id: 'retailer',
    name: 'Retailer',
    address: '0xBE00000000000000000000000000000000000001',
    role: 'retailer',
    farmId: null,
  },
  {
    id: 'no-role',
    name: 'Ví chưa cấp quyền',
    address: '0xEE00000000000000000000000000000000000001',
    role: null,
    farmId: null,
    note: 'Dùng để thử màn không có quyền và cấp role',
  },
]

interface ProgressState {
  action: 'revoke' | 'grant'
  row: RoleRow
  role: Role
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function todayLabel(): string {
  const now = new Date()
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
}

// Hiển thị giờ; nếu bản ghi từ ngày trước thì kèm ngày để phân biệt.
function formatEntryTime(entry: RoleHistoryEntry): string {
  return entry.date === todayLabel() ? entry.time : `${entry.date} ${entry.time}`
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

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4.5"
        y="10"
        width="15"
        height="10.5"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
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

export function RolesPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<RoleRow[]>(INITIAL_ROWS)
  const history = useRoleHistory()
  const [query, setQuery] = useState('')
  const [confirmRow, setConfirmRow] = useState<RoleRow | null>(null)
  const [grantRow, setGrantRow] = useState<RoleRow | null>(null)
  const [grantRole, setGrantRole] = useState<Role>('farmer')
  const [progress, setProgress] = useState<ProgressState | null>(null)

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  const term = query.trim().toLowerCase()
  const filteredRows = rows.filter((row) =>
    `${row.name} ${row.address} ${row.role ? ROLE_LABELS[row.role] : ''}`
      .toLowerCase()
      .includes(term),
  )

  function startRevoke() {
    if (!confirmRow?.role) return
    setProgress({ action: 'revoke', row: confirmRow, role: confirmRow.role })
    setConfirmRow(null)
  }

  function openGrant(row: RoleRow) {
    setGrantRole('farmer')
    setGrantRow(row)
  }

  function startGrant() {
    if (!grantRow) return
    setProgress({ action: 'grant', row: grantRow, role: grantRole })
    setGrantRow(null)
  }

  function finishProgress() {
    if (!progress) return
    const { action, row, role } = progress
    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              role: action === 'revoke' ? null : role,
              farmId: action === 'revoke' ? null : item.farmId,
            }
          : item,
      ),
    )
    recordRoleChange({
      action,
      name: row.name,
      role,
    })
    setProgress(null)
  }

  return (
    <div className="roles-page">
      <PageHeader
        title="Vai trò & quyền"
        description="Role được ghi trên hợp đồng (grantRole/revokeRole). Người dùng không thể tự chọn hay đăng ký role."
      />

      <section className="roles-card" aria-label="Danh sách ví và vai trò">
        <div className="roles-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tra cứu theo tên hoặc địa chỉ ví..."
            aria-label="Tra cứu theo tên hoặc địa chỉ ví"
          />
        </div>

        <div className="roles-table-wrap">
          <table className="roles-table">
            <thead>
              <tr>
                <th>Ví</th>
                <th>Địa chỉ</th>
                <th>Role</th>
                <th>FarmID</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="roles-name">
                      <strong>{row.name}</strong>
                      {row.note && <span>{row.note}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="roles-address">
                      <span className="roles-address-line">
                        <WalletIcon />
                        <span className="mono">{shortAddress(row.address)}</span>
                      </span>
                      <button
                        type="button"
                        className="roles-copy"
                        onClick={() => copyText(row.address, 'Đã sao chép địa chỉ ví')}
                        aria-label={`Sao chép địa chỉ ${row.name}`}
                        title="Sao chép địa chỉ ví"
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </td>
                  <td>
                    {row.role ? (
                      <RolePill role={row.role} />
                    ) : (
                      <span className="roles-role empty">
                        <LockIcon />
                        Chưa có role
                      </span>
                    )}
                  </td>
                  <td className="roles-farm">{row.farmId ?? '—'}</td>
                  <td>
                    {row.admin ? (
                      <span className="roles-locked">Không thể thu hồi Admin</span>
                    ) : row.role ? (
                      <Button
                        variant="secondary"
                        className="roles-action"
                        onClick={() => setConfirmRow(row)}
                      >
                        Thu hồi role
                      </Button>
                    ) : (
                      <Button className="roles-action" onClick={() => openGrant(row)}>
                        Cấp role
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="roles-empty">
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
        {history.length === 0 ? (
          <div className="roles-history-empty">
            <span className="roles-history-icon">
              <ClockIcon />
            </span>
            <strong>Chưa có thay đổi role nào</strong>
          </div>
        ) : (
          <div className="roles-history-list">
            {history.map((entry) => (
              <div className="roles-history-row" key={entry.id}>
                <span className={`roles-history-badge ${entry.action}`}>
                  {entry.action === 'revoke' ? 'Thu hồi' : 'Cấp role'}
                </span>
                <span className="roles-history-main">
                  <strong>{entry.name}</strong>
                  <span>{ROLE_LABELS[entry.role as Role]}</span>
                </span>
                <span className="roles-history-time">{formatEntryTime(entry)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={!!confirmRow}
        onClose={() => setConfirmRow(null)}
        title="Thu hồi role?"
        className="roles-modal roles-modal-confirm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRow(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={startRevoke}>
              Thu hồi
            </Button>
          </>
        }
      >
        <p className="roles-confirm-text">
          Ví {confirmRow?.name} sẽ mất role {confirmRow?.role}. Yêu cầu chuyển đang chờ tới ví này
          sẽ không thể chấp nhận.
        </p>
      </Modal>

      <Modal
        open={!!grantRow}
        onClose={() => setGrantRow(null)}
        title={`Cấp role cho ${grantRow?.name ?? ''}`}
        className="roles-modal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGrantRow(null)}>
              Hủy
            </Button>
            <Button onClick={startGrant}>Xác nhận giao dịch</Button>
          </>
        }
      >
        <div className="roles-grant">
          <label htmlFor="grant-role">Role</label>
          <select
            id="grant-role"
            value={grantRole}
            onChange={(event) => setGrantRole(event.target.value as Role)}
          >
            {GRANTABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <p>Sau khi cấp, hãy gán farmId ở mục Farmer ↔ farmId để ví này tạo được lô.</p>
        </div>
      </Modal>

      <TxProgressModal
        open={!!progress}
        onClose={() => setProgress(null)}
        title={
          progress?.action === 'revoke'
            ? `Thu hồi role của ${progress.row.name}`
            : `Cấp role cho ${progress?.row.name ?? ''}`
        }
        method={progress?.action === 'revoke' ? 'revokeRole()' : 'grantRole()'}
        summary={
          progress
            ? [
                { label: 'Ví', value: progress.row.name },
                {
                  label: progress.action === 'revoke' ? 'Role hiện tại' : 'Role sẽ cấp',
                  value: ROLE_LABELS[progress.role],
                },
              ]
            : []
        }
        txHash={TX_HASH}
        onFinish={finishProgress}
      />
    </div>
  )
}
