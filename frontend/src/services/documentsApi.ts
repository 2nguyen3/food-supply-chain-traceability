import { api } from './api'
import { HttpError } from './http'

export type DocType = 'certificate' | 'image' | 'metadata' | 'invoice' | 'incident_report' | 'recall_reason'

export interface DocumentOut {
  id: string
  doc_type: DocType
  visibility: 'public' | 'private'
  status: 'draft' | 'bound'
  cid: string
  sha256: string
  mime_type: string
  size_bytes: number
  uploader: string
  token_id: string | null
  created_at: string
}

export interface GrantOut {
  document_id: string
  wallet: string
  granted_by: string
  granted_at: string
  revoked_at: string | null
}

export interface DocumentListItem extends DocumentOut {
  /** true khi ví là người tải lên: được cấp hoặc thu hồi quyền đọc */
  can_manage: boolean
  grants: GrantOut[]
}

export interface DownloadedDocument {
  blob: Blob
  filename: string
  /** SHA-256 của bản rõ do backend công bố (header X-Document-Sha256) */
  sha256: string
}

export interface BindResult {
  id: string
  status: string
  token_id: string
  bind_tx_hash: string | null
}

/** Tải tệp lên backend (kiểm nội dung, lên IPFS) và tạo bản nháp. Hash trả về do backend tính trên byte nhận được. */
export function uploadDocument(
  file: Blob,
  filename: string,
  docType: DocType,
  signal?: AbortSignal,
): Promise<DocumentOut> {
  const form = new FormData()
  form.append('file', file, filename)
  form.append('doc_type', docType)
  return api.request<DocumentOut>('/documents', { method: 'POST', body: form, signal })
}

/** Gắn bản nháp vào lô. Tài liệu của createBatch cần txHash; hóa đơn và báo cáo sự cố thì không. */
export function bindDocument(id: string, tokenId: string, txHash?: string): Promise<BindResult> {
  return api.request<BindResult>(`/documents/${id}/bind`, {
    method: 'POST',
    body: JSON.stringify({ token_id: tokenId, tx_hash: txHash ?? null }),
  })
}

/** Tài liệu riêng đã gắn vào lô mà ví đang đăng nhập được phép đọc. */
export function listPrivateDocuments(tokenId: string): Promise<DocumentListItem[]> {
  return api.request<DocumentListItem[]>(`/documents?token_id=${encodeURIComponent(tokenId)}`)
}

export function grantDocumentAccess(id: string, wallet: string): Promise<GrantOut> {
  return api.request<GrantOut>(`/documents/${id}/grants`, { method: 'POST', body: JSON.stringify({ wallet }) })
}

export function revokeDocumentAccess(id: string, wallet: string): Promise<void> {
  return api.request<void>(`/documents/${id}/grants/${wallet}`, { method: 'DELETE' })
}

/** Tải bản đã giải mã của tài liệu riêng; backend kiểm lại vai trò on-chain và quyền đọc mỗi lần. */
export async function downloadPrivateDocument(id: string): Promise<DownloadedDocument> {
  const response = await api.requestRaw(`/documents/${id}/content`)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'tai-lieu'
  return { blob: await response.blob(), filename, sha256: response.headers.get('X-Document-Sha256') ?? '' }
}

export function describeApiError(error: unknown): string {
  if (!(error instanceof HttpError)) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.'
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
    case 'ROLE_REQUIRED':
      return 'Ví của bạn chưa có vai trò phù hợp để tải loại hồ sơ này.'
    case 'FILE_TOO_LARGE':
      return 'Tệp vượt quá 10 MB.'
    case 'UNSUPPORTED_CONTENT':
      return 'Nội dung tệp không đúng loại hồ sơ (PDF, JPEG/PNG hoặc JSON).'
    case 'IPFS_UPLOAD_FAILED':
      return 'Tải lên IPFS thất bại. Chưa có gì được lưu, hãy thử lại.'
    case 'CHAIN_UNAVAILABLE':
      return 'Máy chủ không đọc được blockchain lúc này. Hãy thử lại sau ít giây.'
    case 'TX_RECEIPT_INVALID':
      return 'Máy chủ chưa xác nhận được biên nhận giao dịch. Hãy thử lại sau ít giây.'
    case 'HASH_MISMATCH':
      return 'Hash hồ sơ không khớp với dữ liệu trên blockchain.'
    case 'ALREADY_BOUND':
      return 'Hồ sơ này đã được gắn vào một lô khác.'
    case 'NOT_UPLOADER':
      return 'Chỉ người tải hồ sơ lên mới được thực hiện thao tác này.'
    case 'ACCESS_DENIED':
      return 'Bạn không có quyền đọc tài liệu này, hoặc ví chưa còn vai trò trên hợp đồng.'
    case 'WALLET_NOT_ELIGIBLE':
      return 'Ví này chưa có vai trò nghiệp vụ trên hợp đồng nên chưa thể được cấp quyền.'
    case 'INVALID_WALLET':
      return 'Địa chỉ ví không hợp lệ.'
    case 'GRANT_NOT_FOUND':
      return 'Quyền đọc này không còn hiệu lực để thu hồi.'
    case 'NETWORK_ERROR':
      return 'Không kết nối được máy chủ. Hãy kiểm tra backend rồi thử lại.'
    case 'API_NOT_CONFIGURED':
      return 'Chưa cấu hình địa chỉ máy chủ (VITE_API_BASE_URL).'
    default:
      return error.message
  }
}
