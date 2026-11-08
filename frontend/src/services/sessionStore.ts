/**
 * Phiên đăng nhập được giữ trong sessionStorage để sống qua F5: mất khi đóng tab, không dùng chung giữa
 * các tab và không nằm lại sau khi đóng trình duyệt (khác localStorage). Vai trò và mạng không được lưu:
 * mỗi lần khôi phục đều đọc lại từ hợp đồng và từ ví.
 */
const KEY = 'cocomark:session'

export interface StoredSession {
  address: string
  token: string
  /** Thời điểm phiên hết hạn (ms). */
  expiresAt: number
}

export function saveStoredSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // trình duyệt chặn lưu trữ: phiên chỉ sống đến khi tải lại trang
  }
}

export function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // không có gì để xóa
  }
}

/** Phiên đã lưu và còn hạn; sai định dạng hoặc hết hạn thì bị xóa và trả null. */
export function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredSession>
    if (
      typeof value.address === 'string' &&
      typeof value.token === 'string' &&
      typeof value.expiresAt === 'number' &&
      value.expiresAt > Date.now()
    )
      return value as StoredSession
  } catch {
    // dữ liệu hỏng
  }
  clearStoredSession()
  return null
}
