import { api, tokens } from './api'
import { HttpError } from './http'

export interface Challenge {
  wallet: string
  nonce: string
  domain: string
  chain_id: number
  issued_at: string
  expires_at: string
  message: string
}

export function requestChallenge(wallet: string, signal?: AbortSignal): Promise<Challenge> {
  return api.request<Challenge>('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
    signal,
  })
}

/** Gửi chữ ký lên backend; thành công thì giữ access token trong bộ nhớ và trả thời điểm hết hạn (ms). */
export async function verifyLogin(
  wallet: string,
  nonce: string,
  signature: string,
): Promise<{ expiresAt: number }> {
  const result = await api.request<{ access_token: string; expires_at: string }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, nonce, signature }),
  })
  tokens.setToken(result.access_token)
  return { expiresAt: Date.parse(result.expires_at) }
}

/** Thu hồi phiên ở backend (cần gọi trước khi xóa token). */
export async function logoutApi(): Promise<void> {
  if (!tokens.getToken()) return
  await api.request<void>('/auth/logout', { method: 'POST' })
}

export function describeAuthError(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'NONCE_INVALID':
        return 'Thông điệp đã hết hạn hoặc đã dùng. Đã tạo thông điệp mới, hãy ký lại.'
      case 'SIGNATURE_INVALID':
        return 'Chữ ký không khớp với ví. Hãy kiểm tra tài khoản trong MetaMask và ký lại.'
      case 'INVALID_WALLET':
        return 'Địa chỉ ví không hợp lệ.'
      case 'NETWORK_ERROR':
        return 'Không kết nối được máy chủ. Hãy kiểm tra backend rồi thử lại.'
      case 'API_NOT_CONFIGURED':
        return 'Chưa cấu hình địa chỉ máy chủ (VITE_API_BASE_URL).'
      default:
        return error.message
    }
  }
  return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.'
}
