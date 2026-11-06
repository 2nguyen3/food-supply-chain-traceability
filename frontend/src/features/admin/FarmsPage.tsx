import { useEffect, useState } from 'react'
import { Button, Modal, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { TxProgressModal } from './TxProgressModal'
import './styles/roles.css'
import './styles/farms.css'

interface FarmRow {
  id: string
  name: string
  address: `0x${string}`
  farmId: string | null
  batches: number
}

const INITIAL_ROWS: FarmRow[] = [
  {
    id: 'farmer-a',
    name: 'Farmer A',
    address: '0xFA00000000000000000000000000000000000001',
    farmId: 'FARM-A',
    batches: 3,
  },
  {
    id: 'farmer-b',
    name: 'Farmer B',
    address: '0xFB00000000000000000000000000000000000001',
    farmId: null,
    batches: 1,
  },
]

const TX_HASHES: Record<string, string> = {
  'farmer-a': '0x3c24b4a1b2c3d4e5f60718293a4b5c6d4f23a8',
  'farmer-b': '0xe61e918a2b3c4d5e6f708192a3b4c5d66b749d',
}

const FALLBACK_TX_HASH = '0x3c24b4a1b2c3d4e5f60718293a4b5c6d4f23a8'

const STORAGE_KEY = 'cocomark.admin.farmMappings'

function loadRows(): FarmRow[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_ROWS
    const saved = JSON.parse(raw) as Record<string, string | null>
    return INITIAL_ROWS.map((row) =>
      Object.prototype.hasOwnProperty.call(saved, row.id) ? { ...row, farmId: saved[row.id] } : row,
    )
  } catch {
    return INITIAL_ROWS
  }
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

interface MappingState {
  row: FarmRow
  farmId: string
}

export function FarmsPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<FarmRow[]>(loadRows)
  const [editRow, setEditRow] = useState<FarmRow | null>(null)
  const [farmId, setFarmId] = useState('')
  const [progress, setProgress] = useState<MappingState | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Object.fromEntries(rows.map((row) => [row.id, row.farmId]))),
      )
    } catch {
      // Bỏ qua nếu trình duyệt chặn localStorage.
    }
  }, [rows])

  const trimmedFarmId = farmId.trim()

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  function openMapping(row: FarmRow) {
    setFarmId(row.farmId ?? '')
    setEditRow(row)
  }

  function startMapping() {
    if (!editRow || !trimmedFarmId) return
    setProgress({ row: editRow, farmId: trimmedFarmId.toUpperCase() })
    setEditRow(null)
  }

  function finishMapping() {
    if (!progress) return
    setRows((current) =>
      current.map((item) =>
        item.id === progress.row.id ? { ...item, farmId: progress.farmId } : item,
      ),
    )
    showToast(`Đã gán ${progress.farmId} cho ${progress.row.name}`, 'success')
    setProgress(null)
  }

  return (
    <div className="farms-page">
      <PageHeader
        title="Farmer ↔ farmId"
        description="Mỗi Farmer có một farmId do Admin gán. Farmer không thể tự sửa farmId khi tạo lô."
      />

      <section className="roles-card" aria-label="Danh sách Farmer và farmId">
        <div className="roles-table-wrap">
          <table className="roles-table farms-table">
            <thead>
              <tr>
                <th>Ví farmer</th>
                <th>Địa chỉ</th>
                <th>FarmID</th>
                <th>Số lô</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong className="farms-name">{row.name}</strong>
                  </td>
                  <td>
                    <div className="farms-address">
                      <span className="farms-address-line">
                        <WalletIcon />
                        <span className="mono">{shortAddress(row.address)}</span>
                      </span>
                      <button
                        type="button"
                        className="farms-copy"
                        onClick={() => copyText(row.address, 'Đã sao chép địa chỉ ví')}
                        aria-label={`Sao chép địa chỉ ${row.name}`}
                        title="Sao chép địa chỉ ví"
                      >
                        <CopyIcon />
                      </button>
                    </div>
                  </td>
                  <td>
                    {row.farmId ? (
                      <span className="farms-farmid">{row.farmId}</span>
                    ) : (
                      <span className="farms-unassigned">Chưa gán</span>
                    )}
                  </td>
                  <td className="farms-batches">{row.batches}</td>
                  <td>
                    {row.farmId ? (
                      <Button
                        variant="secondary"
                        className="roles-action"
                        onClick={() => openMapping(row)}
                      >
                        Thay mapping
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="roles-action"
                        onClick={() => openMapping(row)}
                      >
                        Gán farmId
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title={`farmId cho ${editRow?.name ?? ''}`}
        className="roles-modal"
        footer={
          <div className="farms-modal-foot">
            <div className="farms-modal-actions">
              <Button variant="secondary" onClick={() => setEditRow(null)}>
                Hủy
              </Button>
              <Button onClick={startMapping} disabled={!trimmedFarmId}>
                Xác nhận giao dịch
              </Button>
            </div>
            {!trimmedFarmId && <span className="farms-error">Nhập farmId.</span>}
          </div>
        }
      >
        <div className="farms-form">
          <label htmlFor="farm-id">farmId</label>
          <input
            id="farm-id"
            value={farmId}
            onChange={(event) => setFarmId(event.target.value.toUpperCase())}
            autoFocus
          />
          <span className="farms-hint">Ví dụ FARM-A</span>
          <p className="farms-note">Thay farmId không đổi dữ liệu các lô đã tạo.</p>
        </div>
      </Modal>

      <TxProgressModal
        open={!!progress}
        onClose={() => setProgress(null)}
        title={`Gán ${progress?.farmId ?? ''} cho ${progress?.row.name ?? ''}`}
        method="setFarmId()"
        summary={
          progress
            ? [
                { label: 'Ví', value: progress.row.name },
                { label: 'farmId', value: progress.farmId },
              ]
            : []
        }
        txHash={progress ? (TX_HASHES[progress.row.id] ?? FALLBACK_TX_HASH) : FALLBACK_TX_HASH}
        onFinish={finishMapping}
      />
    </div>
  )
}
