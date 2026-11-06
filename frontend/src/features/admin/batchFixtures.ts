import type { Lifecycle } from '../../domain/types'

export interface BatchSummary {
  code: string
  tokenId: number
  farmId: string
  groupId: string
  weightKg: number
  ownerLabel: string
  ownerAddress: `0x${string}`
  lifecycle: Lifecycle
  recalled?: boolean
  expiration: string
}

export const BATCH_ROWS: BatchSummary[] = [
  {
    code: 'COCONUT-001',
    tokenId: 1,
    farmId: 'FARM-A',
    groupId: 'HG-A01',
    weightKg: 1000,
    ownerLabel: 'Retailer',
    ownerAddress: '0xBE00000000000000000000000000000000000001',
    lifecycle: 'Sold',
    expiration: '16/12/2026',
  },
  {
    code: 'COCONUT-002',
    tokenId: 2,
    farmId: 'FARM-A',
    groupId: 'HG-A01',
    weightKg: 1000,
    ownerLabel: 'Retailer',
    ownerAddress: '0xBE00000000000000000000000000000000000001',
    lifecycle: 'Sold',
    expiration: '16/12/2026',
  },
  {
    code: 'COCONUT-003',
    tokenId: 3,
    farmId: 'FARM-A',
    groupId: 'HG-A02',
    weightKg: 1000,
    ownerLabel: 'Retailer',
    ownerAddress: '0xBE00000000000000000000000000000000000001',
    lifecycle: 'Delivered',
    expiration: '23/12/2026',
  },
  {
    code: 'COCONUT-004',
    tokenId: 4,
    farmId: 'FARM-B',
    groupId: 'HG-B01',
    weightKg: 1000,
    ownerLabel: 'Farmer B',
    ownerAddress: '0xFB00000000000000000000000000000000000001',
    lifecycle: 'Created',
    expiration: '31/12/2026',
  },
]

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  Created: 'Đã tạo',
  InTransit: 'Đang vận chuyển',
  Delivered: 'Đã giao',
  Sold: 'Đã bán',
}

export const LIFECYCLE_PILL: Record<Lifecycle, string> = {
  Created: 'Created · Đã tạo',
  InTransit: 'InTransit · Đang vận chuyển',
  Delivered: 'Delivered · Đã giao',
  Sold: 'Sold · Đã bán',
}

export interface BatchDetail {
  code: string
  tokenId: number
  farmId: string
  groupId: string
  weightKg: number
  farmLocation: string
  harvestDate: string
  expiryDate: string
  variety: string
  fertilizer: string
  tempMin: number
  tempMax: number
  ownerLabel: string
  ownerAddress: `0x${string}`
  lifecycle: Lifecycle
  metadataUri: string
  metadataCid: string
}

const DETAILS: Record<string, Omit<BatchDetail, 'code' | 'tokenId' | 'weightKg'>> = {
  'COCONUT-001': {
    farmId: 'FARM-A',
    groupId: 'HG-A01',
    farmLocation: 'Giồng Trôm, Bến Tre',
    harvestDate: '17/10/2026',
    expiryDate: '16/12/2026',
    variety: 'Dừa xiêm xanh',
    fertilizer: 'Phân hữu cơ vi sinh',
    tempMin: 8,
    tempMax: 15,
    ownerLabel: 'Retailer',
    ownerAddress: '0xBE00000000000000000000000000000000000001',
    lifecycle: 'Sold',
    metadataUri: 'ipfs://bafybeik5a6b7c8d9e0f1g2h3ghrpq',
    metadataCid: 'bafybeik5a6b7c8d9e0f1g2h3ghrpq',
  },
  'COCONUT-002': {
    farmId: 'FARM-A',
    groupId: 'HG-A01',
    farmLocation: 'Giồng Trôm, Bến Tre',
    harvestDate: '17/10/2026',
    expiryDate: '16/12/2026',
    variety: 'Dừa xiêm xanh',
    fertilizer: 'Phân hữu cơ vi sinh',
    tempMin: 8,
    tempMax: 15,
    ownerLabel: 'Retailer',
    ownerAddress: '0xBE00000000000000000000000000000000000001',
    lifecycle: 'Sold',
    metadataUri: 'ipfs://bafybeik5a6b7c8d9e0f1g2h3ghrpq',
    metadataCid: 'bafybeik5a6b7c8d9e0f1g2h3ghrpq',
  },
  'COCONUT-003': {
    farmId: 'FARM-A',
    groupId: 'HG-A02',
    farmLocation: 'Giồng Trôm, Bến Tre',
    harvestDate: '24/10/2026',
    expiryDate: '23/12/2026',
    variety: 'Dừa xiêm xanh',
    fertilizer: 'Phân hữu cơ vi sinh',
    tempMin: 8,
    tempMax: 15,
    ownerLabel: 'Retailer',
    ownerAddress: '0xBE00000000000000000000000000000000000001',
    lifecycle: 'Delivered',
    metadataUri: 'ipfs://bafybeik5a6b7c8d9e0f1g2h3ghrpq',
    metadataCid: 'bafybeik5a6b7c8d9e0f1g2h3ghrpq',
  },
  'COCONUT-004': {
    farmId: 'FARM-B',
    groupId: 'HG-B01',
    farmLocation: 'Châu Thành, Bến Tre',
    harvestDate: '01/11/2026',
    expiryDate: '31/12/2026',
    variety: 'Dừa xiêm xanh',
    fertilizer: 'Phân hữu cơ vi sinh',
    tempMin: 8,
    tempMax: 15,
    ownerLabel: 'Farmer B',
    ownerAddress: '0xFB00000000000000000000000000000000000001',
    lifecycle: 'Created',
    metadataUri: 'ipfs://bafybeik5a6b7c8d9e0f1g2h3ghrpq',
    metadataCid: 'bafybeik5a6b7c8d9e0f1g2h3ghrpq',
  },
}

export function getBatchDetail(code: string): BatchDetail | null {
  const summary = BATCH_ROWS.find((row) => row.code === code)
  const detail = DETAILS[code]
  if (!summary || !detail) return null
  return {
    code: summary.code,
    tokenId: summary.tokenId,
    weightKg: summary.weightKg,
    ...detail,
  }
}

export interface PublicDocument {
  id: 'metadata' | 'certificate' | 'image'
  name: string
  description: string
  size: string
  cid: string
  sha256: string
  shortCid: string
  shortSha: string
}

export const PUBLIC_DOCUMENTS: PublicDocument[] = [
  {
    id: 'metadata',
    name: 'metadata.json',
    description: 'Metadata JSON công khai',
    size: '1 KB',
    cid: 'bafybeik5a6b7c8d9e0f1g2h3ghrpq',
    sha256: '4b73fdadb7a1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60717c8fee',
    shortCid: 'bafybeik5...ghrpq',
    shortSha: '4b73fdadb...7c8fee',
  },
  {
    id: 'certificate',
    name: 'certificate.pdf',
    description: 'PDF chứng chỉ gốc',
    size: '243 KB',
    cid: 'bafybeilr1s2t3u4v5w6x7y8zwxty4f',
    sha256: 'd94c1c57e15e80397653b6fa84cc6c7a1404b2e21cace34a6e371f985f986fa8',
    shortCid: 'bafybeilr...wxty4f',
    shortSha: 'd94c1c57e...986fa8',
  },
  {
    id: 'image',
    name: 'batch.jpg',
    description: 'Ảnh gốc của lô',
    size: '1762 KB',
    cid: 'bafybeilx2m3n4o5p6q7r8s9t0uk3qkek',
    sha256: 'ae79f021b3c4d5e6f708192a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f1b8ae',
    shortCid: 'bafybeilx...k3qkek',
    shortSha: 'ae79f021b...f1b8ae',
  },
]

export const METADATA_JSON = {
  schemaVersion: '1.0',
  name: 'COCOMARK COCONUT-001',
  batchCode: 'COCONUT-001',
  quantityKg: 1000,
  farmId: 'FARM-A',
  farmLocation: 'Giồng Trôm, Bến Tre',
  harvestGroupId: 'HG-A01',
  harvestDate: '2026-10-17',
  expiryDate: '2026-12-16',
  variety: 'Dừa xiêm xanh',
  fertilizer: 'Phân hữu cơ vi sinh',
  temperatureThresholdC: {
    min: 8,
    max: 15,
  },
  image: 'ipfs://bafybeilx2m3n4o5p6q7r8s9t0uk3qkek',
  certificateURI: 'ipfs://bafybeilr1s2t3u4v5w6x7y8zwxty4f',
  imageSha256: 'ae79f021b3c4d5e6f708192a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f1b8ae',
  certificateSha256: 'd94c1c57e15e80397653b6fa84cc6c7a1404b2e21cace34a6e371f985f986fa8',
  note: 'Dữ liệu mô phỏng cho prototype COCOMARK',
}

export interface TemperatureReading {
  id: number
  temperatureC: number
  centiC: number
  observedAt: string
  blockAt: string
  location: string
  txHash: string
  over: boolean
}

export const READINGS: TemperatureReading[] = [
  {
    id: 1,
    temperatureC: 10,
    centiC: 1000,
    observedAt: '10:00 24/10/2026',
    blockAt: '10:20 24/10/2026',
    location: 'Trạm thu mua Giồng Trôm, Bến Tre',
    txHash: '0x96750c4a1b2c3d4e5f60718293a4b5c6d8609c6',
    over: false,
  },
  {
    id: 2,
    temperatureC: 12,
    centiC: 1200,
    observedAt: '11:00 24/10/2026',
    blockAt: '11:21 24/10/2026',
    location: 'QL60, Tiền Giang',
    txHash: '0xa79e73f1e2d3c4b5a69788796be5219',
    over: false,
  },
  {
    id: 3,
    temperatureC: 18,
    centiC: 1800,
    observedAt: '12:00 24/10/2026',
    blockAt: '12:22 24/10/2026',
    location: 'Trạm trung chuyển Long An',
    txHash: '0xd8c233a1b2c3d4e5f60718293a4b06943d',
    over: true,
  },
  {
    id: 4,
    temperatureC: 13,
    centiC: 1300,
    observedAt: '13:00 24/10/2026',
    blockAt: '13:23 24/10/2026',
    location: 'Cửa ngõ TP.HCM',
    txHash: '0x3fb2b3c1d2e3f4a5b60718293a4bdf6d4d',
    over: false,
  },
  {
    id: 5,
    temperatureC: 11,
    centiC: 1100,
    observedAt: '14:00 24/10/2026',
    blockAt: '14:24 24/10/2026',
    location: 'Kho lạnh Thủ Đức',
    txHash: '0x7e0459a1b2c3d4e5f60718293a4b4d8605',
    over: false,
  },
]

export interface JourneyEvent {
  id: string
  kind: 'mint' | 'handoff' | 'reading' | 'sold' | 'incident' | 'recall'
  title: string
  description: string
  time: string
  txHash: string
}

export const JOURNEY_EVENTS: JourneyEvent[] = [
  {
    id: 'mint',
    kind: 'mint',
    title: 'Khởi tạo lô và mint NFT',
    description: 'Khởi tạo NFT cho COCONUT-001, 1.000 kg',
    time: '08:30 24/10/2026',
    txHash: '0xf8b69ca1b2c3d4e5f60718293a4b9cfb30',
  },
  {
    id: 'handoff-logistics',
    kind: 'handoff',
    title: 'Bàn giao đã xác nhận',
    description: 'Logistics xác nhận nhận lô; chủ sở hữu NFT chuyển sang Logistics',
    time: '09:30 24/10/2026',
    txHash: '0xcf9707a1b2c3d4e5f60718293a4b1f6735',
  },
  {
    id: 'reading-1',
    kind: 'reading',
    title: 'Bản ghi vận chuyển',
    description: 'Bản ghi nhiệt độ #1: 10.0°C tại Trạm thu mua Giồng Trôm, Bến Tre',
    time: '10:20 24/10/2026',
    txHash: '0x96750c4a1b2c3d4e5f60718293a4b5c6d8609c6',
  },
  {
    id: 'reading-2',
    kind: 'reading',
    title: 'Bản ghi vận chuyển',
    description: 'Bản ghi nhiệt độ #2: 12.0°C tại QL60, Tiền Giang',
    time: '11:21 24/10/2026',
    txHash: '0xa79e73f1e2d3c4b5a69788796be5219',
  },
  {
    id: 'reading-3',
    kind: 'reading',
    title: 'Bản ghi vận chuyển',
    description: 'Bản ghi nhiệt độ #3: 18.0°C tại Trạm trung chuyển Long An',
    time: '12:22 24/10/2026',
    txHash: '0xd8c233a1b2c3d4e5f60718293a4b06943d',
  },
  {
    id: 'reading-4',
    kind: 'reading',
    title: 'Bản ghi vận chuyển',
    description: 'Bản ghi nhiệt độ #4: 13.0°C tại Cửa ngõ TP.HCM',
    time: '13:23 24/10/2026',
    txHash: '0x3fb2b3c1d2e3f4a5b60718293a4bdf6d4d',
  },
  {
    id: 'reading-5',
    kind: 'reading',
    title: 'Bản ghi vận chuyển',
    description: 'Bản ghi nhiệt độ #5: 11.0°C tại Kho lạnh Thủ Đức',
    time: '14:24 24/10/2026',
    txHash: '0x7e0459a1b2c3d4e5f60718293a4b4d8605',
  },
  {
    id: 'handoff-retailer',
    kind: 'handoff',
    title: 'Bàn giao đã xác nhận',
    description: 'Retailer xác nhận nhận lô; chủ sở hữu NFT chuyển sang Retailer',
    time: '09:00 25/10/2026',
    txHash: '0x286067a1b2c3d4e5f60718293a4b975b34',
  },
  {
    id: 'sold',
    kind: 'sold',
    title: 'Đã bán',
    description: 'Retailer xác nhận đã bán lô; NFT vẫn thuộc Retailer',
    time: '10:15 27/10/2026',
    txHash: '0x7eaccba1b2c3d4e5f60718293a4b2dccf3',
  },
]

export interface NftTransfer {
  id: number
  from: string
  to: string
  time: string
  txHash: string
}

export const NFT_TRANSFERS: NftTransfer[] = [
  {
    id: 1,
    from: '0x0000...0000 (mint)',
    to: 'Farmer A',
    time: '08:30 24/10/2026',
    txHash: '0xf8b69ca1b2c3d4e5f60718293a4b9cfb30',
  },
  {
    id: 2,
    from: 'Farmer A',
    to: 'Logistics',
    time: '09:30 24/10/2026',
    txHash: '0xcf9707a1b2c3d4e5f60718293a4b1f6735',
  },
  {
    id: 3,
    from: 'Logistics',
    to: 'Retailer',
    time: '09:00 25/10/2026',
    txHash: '0x286067a1b2c3d4e5f60718293a4b975b34',
  },
]

export const QR_DEMO_PATH = '/trace/demo/COCONUT-001'

export const QR_TECHNICAL = {
  canonical: '/trace/11155111/0x…(địa chỉ hợp đồng khi triển khai)/1',
  note: 'QR chỉ chứa địa chỉ công khai, không chứa khóa, hóa đơn hay trạng thái. URL demo không phải URL của hợp đồng đã triển khai. Dữ liệu demo nằm trong trình duyệt, nên thiết bị khác chỉ mở được trang nếu truy cập được URL này và sẽ thấy dữ liệu ban đầu, không đồng bộ trạng thái.',
  tokenUri: 'bafybeik5...ghrpq',
  ipfs: 'ipfs://bafybeik5a6b7c8d9e0f1g2h3ghrpq',
}
