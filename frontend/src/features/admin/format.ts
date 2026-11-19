/** Định dạng hiển thị dùng chung cho khu vực Admin (không chứa dữ liệu giả). */
import type { Lifecycle } from '../../domain/types'

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

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}

export function shortCid(cid: string): string {
  return `${cid.slice(0, 12)}...${cid.slice(-6)}`
}

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_ONLY = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Giờ Việt Nam, có ngày và phút. */
export function formatTime(iso: string): string {
  return DATE_TIME.format(new Date(iso))
}

/** Chỉ ngày, dùng cho hạn sử dụng / ngày thu hoạch. */
export function formatDate(iso: string): string {
  return DATE_ONLY.format(new Date(iso))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
