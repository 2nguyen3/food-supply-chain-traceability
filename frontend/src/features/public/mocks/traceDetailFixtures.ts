import type { Lifecycle } from '../../../domain/types'
import { TRACE_DEMO_CODES } from './traceSearchFixtures'

export type DemoActor = 'Farmer A' | 'Farmer B' | 'Logistics' | 'Retailer' | (string & {})
export type DemoEventKind =
  | 'BatchCreated'
  | 'TransferAccepted'
  | 'TransitRecorded'
  | 'BatchSold'
  | 'IncidentReported'
  | 'BatchRecalled'

export interface DemoEvent {
  id: string
  kind: DemoEventKind
  at: string
  detail: string
  transactionHash?: string
  /** Tệp đính kèm công khai của sự kiện (báo cáo sự cố, lý do thu hồi). */
  attachment?: { label: string; url: string }
}

export interface DemoOwnership {
  id: string
  kind: 'mint' | 'transfer'
  from: DemoActor | 'zero-address'
  to: DemoActor
  at: string
  transactionHash?: string
}

export interface DemoReading {
  id: number
  observedAt: string
  temperatureC: number
  location?: string
  transactionHash?: string
  /** Thời điểm block ghi nhận (khác thời điểm quan sát của thiết bị). */
  blockTime?: string
}

export interface DemoDocument {
  name: 'certificate.pdf' | 'batch.jpg' | 'metadata.json' | (string & {})
  label: string
  cid?: string
  sha256?: string
  fileUrl?: string
  /** Kết quả đối chiếu SHA-256 byte tải về với hash trên chain (chỉ có khi đọc chain thật). */
  verified?: 'match' | 'mismatch' | 'unavailable'
}

export interface DemoBatch {
  code: string
  tokenId: string
  farmId: string
  harvestGroupId: string
  lifecycle: Lifecycle
  recalled: boolean
  owner: DemoActor
  farmer: DemoActor
  quantityKg: 1000
  farmLocation?: string
  variety?: string
  fertilizer?: string
  harvestDate?: string
  expiryDate?: string
  contractAddress?: string
  tokenUri?: string
  metadataCid?: string
  minTemperatureC?: number
  maxTemperatureC?: number
  events: DemoEvent[]
  ownership: DemoOwnership[]
  readings: DemoReading[]
  documents: DemoDocument[]
  /** 'chain' khi đọc từ blockchain thật; mặc định là dữ liệu mẫu. */
  source?: 'demo' | 'chain'
  network?: string
  imageUrl?: string
  warnings?: string[]
  /** Địa chỉ ví đầy đủ theo nhãn hiển thị (chỉ có khi đọc chain thật). */
  wallets?: Record<string, string>
  ownerAddress?: string
  farmerAddress?: string
}

const DOCUMENTS: DemoDocument[] = [
  { name: 'certificate.pdf', label: 'Chứng chỉ PDF gốc' },
  { name: 'batch.jpg', label: 'Ảnh gốc của lô' },
  { name: 'metadata.json', label: 'Metadata JSON công khai' },
]

const schedule = {
  created: '2026-10-16T08:00:00+07:00',
  logistics: '2026-10-17T08:00:00+07:00',
  retailer: '2026-10-18T08:00:00+07:00',
  sold: '2026-10-19T08:00:00+07:00',
}

const readings001: DemoReading[] = [10, 12, 18, 13, 11].map((temperatureC, index) => ({
  id: index + 1,
  temperatureC,
  observedAt: `2026-10-17T${String(9 + index).padStart(2, '0')}:00:00+07:00`,
}))

function makeFixture(
  code: string,
  tokenId: string,
  farmId: string,
  harvestGroupId: string,
  farmer: DemoActor,
  lifecycle: Lifecycle,
  readings: DemoReading[] = [],
): DemoBatch {
  const travelled = lifecycle !== 'Created'
  const delivered = lifecycle === 'Delivered' || lifecycle === 'Sold'
  const sold = lifecycle === 'Sold'
  const events: DemoEvent[] = [
    {
      id: `${code}-created`,
      kind: 'BatchCreated',
      at: schedule.created,
      detail: `${farmer} tạo lô 1.000 kg và mint NFT mẫu.`,
    },
  ]
  const ownership: DemoOwnership[] = [
    { id: `${code}-mint`, kind: 'mint', from: 'zero-address', to: farmer, at: schedule.created },
  ]

  if (travelled) {
    events.push({
      id: `${code}-to-logistics`,
      kind: 'TransferAccepted',
      at: schedule.logistics,
      detail: `${farmer} bàn giao cho Logistics; quyền sở hữu NFT chuyển trong cùng bước.`,
    })
    ownership.push({
      id: `${code}-nft-logistics`,
      kind: 'transfer',
      from: farmer,
      to: 'Logistics',
      at: schedule.logistics,
    })
  }

  if (readings.length) {
    events.push({
      id: `${code}-transit`,
      kind: 'TransitRecorded',
      at: readings[0].observedAt,
      detail: `${readings.length} bản ghi nhiệt độ mẫu trong quá trình vận chuyển.`,
    })
  }

  if (delivered) {
    events.push({
      id: `${code}-to-retailer`,
      kind: 'TransferAccepted',
      at: schedule.retailer,
      detail: 'Logistics bàn giao cho Retailer; quyền sở hữu NFT chuyển trong cùng bước.',
    })
    ownership.push({
      id: `${code}-nft-retailer`,
      kind: 'transfer',
      from: 'Logistics',
      to: 'Retailer',
      at: schedule.retailer,
    })
  }

  if (sold) {
    events.push({
      id: `${code}-sold`,
      kind: 'BatchSold',
      at: schedule.sold,
      detail: 'Retailer đánh dấu lô đã bán; NFT vẫn thuộc Retailer.',
    })
  }

  return {
    code,
    tokenId,
    farmId,
    harvestGroupId,
    farmer,
    lifecycle,
    recalled: false,
    owner: delivered ? 'Retailer' : travelled ? 'Logistics' : farmer,
    quantityKg: 1000,
    minTemperatureC: readings.length ? 8 : undefined,
    maxTemperatureC: readings.length ? 15 : undefined,
    events,
    ownership,
    readings,
    documents: DOCUMENTS.map((document) => ({ ...document })),
  }
}

const fixtures = [
  makeFixture('COCONUT-001', '1', 'FARM-A', 'HG-A01', 'Farmer A', 'Sold', readings001),
  makeFixture('COCONUT-002', '2', 'FARM-A', 'HG-A01', 'Farmer A', 'Sold'),
  makeFixture('COCONUT-003', '3', 'FARM-A', 'HG-A02', 'Farmer A', 'Delivered'),
  makeFixture('COCONUT-004', '4', 'FARM-B', 'HG-B01', 'Farmer B', 'Created'),
]

if (fixtures.some((batch, index) => batch.code !== TRACE_DEMO_CODES[index])) {
  throw new Error('Mã lô demo không khớp fixture tra cứu công khai.')
}

export function getDemoBatch(code: string): DemoBatch | undefined {
  return fixtures.find((batch) => batch.code === code.trim().toUpperCase())
}
