import type { Lifecycle } from '../../domain/types'

export interface IncidentEvidence {
  kind: 'json' | 'pdf'
  label: string
  name: string
  size: string
  cid: string
  shortCid: string
  sha256: string
  shortSha: string
}

export interface IncidentRecord {
  id: string
  batchCode: string
  tokenId: number
  reporter: string
  reporterAddress: `0x${string}`
  time: string
  description: string
  reportTx: string
  farmer: string
  farmerAddress: `0x${string}`
  farmId: string
  harvestGroupId: string
  evidence: IncidentEvidence[]
}

export const INCIDENTS: IncidentRecord[] = [
  {
    id: 'INC-0001',
    batchCode: 'COCONUT-001',
    tokenId: 1,
    reporter: 'Retailer',
    reporterAddress: '0xBE00000000000000000000000000000000000001',
    time: '10:31 05/11/2026',
    description: 'Một số trái mùi lạ khi mở',
    reportTx: '0xb5c8657a1b2c3d4e5f60718293a4b5c6d8bdcd47',
    farmer: 'Farmer A',
    farmerAddress: '0xFA00000000000000000000000000000000000001',
    farmId: 'FARM-A',
    harvestGroupId: 'HG-A01',
    evidence: [
      {
        kind: 'json',
        label: 'Bằng chứng JSON',
        name: 'incident-evidence.json',
        size: '2 KB',
        cid: 'bafybeile7xq2m3n4o5p6q7r8s9t0k4zh3g',
        shortCid: 'bafybeile...k4zh3g',
        sha256: '421472ae7c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f228dde',
        shortSha: '421472ae7...228dde',
      },
      {
        kind: 'pdf',
        label: 'Bằng chứng PDF',
        name: 'incident-report.pdf',
        size: '186 KB',
        cid: 'bafybei6i2xq3m4n5o6p7q8r9s0t5okosv',
        shortCid: 'bafybei6i...5okosv',
        sha256: '46123e426c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e32e40',
        shortSha: '46123e426...e32e40',
      },
    ],
  },
]

export function getIncident(id: string): IncidentRecord | null {
  return INCIDENTS.find((incident) => incident.id === id) ?? null
}

export type RelatedClassification = 'reported' | 'candidate' | 'control'

export interface RelatedBatch {
  code: string
  farmId: string
  groupId: string
  lifecycle: Lifecycle
  classification: RelatedClassification
  note: string
}

export const RELATED_BATCHES: Record<string, RelatedBatch[]> = {
  'INC-0001': [
    {
      code: 'COCONUT-001',
      farmId: 'FARM-A',
      groupId: 'HG-A01',
      lifecycle: 'Sold',
      classification: 'reported',
      note: 'Cùng farmId và cùng harvestGroupId',
    },
    {
      code: 'COCONUT-002',
      farmId: 'FARM-A',
      groupId: 'HG-A01',
      lifecycle: 'Sold',
      classification: 'candidate',
      note: 'Cùng farmId và cùng harvestGroupId',
    },
    {
      code: 'COCONUT-003',
      farmId: 'FARM-A',
      groupId: 'HG-A02',
      lifecycle: 'Delivered',
      classification: 'control',
      note: 'Cùng farmId, khác nhóm thu hoạch',
    },
    {
      code: 'COCONUT-004',
      farmId: 'FARM-B',
      groupId: 'HG-B01',
      lifecycle: 'Created',
      classification: 'control',
      note: 'Khác farmId',
    },
  ],
}

export const CLASSIFICATION_LABEL: Record<RelatedClassification, string> = {
  reported: 'Lô được báo cáo',
  candidate: 'Ứng viên liên quan',
  control: 'Đối chứng',
}

export const RECALL_TX_HASH = '0x538077a1b2c3d4e5f60718293a4b0b558c'
export const RECALL_REASON_CID = 'bafybeihq4m5n6o7p8q9r0s1t2u3v4w5x6y7z8recall'
export const RECALL_TIME = '10:38 05/11/2026'
export const RECALL_SCOPE = 'Chỉ một lô này'

export const INCIDENT_WARNING_TEXT =
  'Thu hồi không xóa lịch sử sự kiện hay quyền sở hữu NFT; lô đã Sold vẫn là Sold và hiển thị thêm "Đã thu hồi". Không có thu hồi hàng loạt.'

export const TEMP_NOTE_TEXT =
  'Giá trị đọc từ CSV bởi script Python/Web3.py (không phải cảm biến vật lý). Vùng xanh là ngưỡng minh họa trong metadata.'

export const TEMP_OVER_TEXT =
  'Đây là một lần vượt ngưỡng nhiệt độ ghi nhận trong dữ liệu vận chuyển, không tự động là bằng chứng nhiễm khuẩn hay mất an toàn thực phẩm.'
