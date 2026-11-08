import type { ApiError } from '../domain/types'
export interface TokenProvider {
  getToken(): string | null
  clearToken(): void
}
export class MemoryTokenProvider implements TokenProvider {
  private token: string | null = null
  getToken() {
    return this.token
  }
  setToken(value: string | null) {
    this.token = value
  }
  clearToken() {
    this.token = null
  }
}
export class HttpError extends Error implements ApiError {
  code: string
  status?: number
  details?: unknown
  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}
export class HttpClient {
  private baseUrl: string
  private tokens: TokenProvider
  private fetcher: typeof fetch
  // bọc fetch: trình duyệt báo "Illegal invocation" nếu fetch bị gọi với this là HttpClient
  constructor(
    baseUrl: string,
    tokens: TokenProvider,
    fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.baseUrl = baseUrl
    this.tokens = tokens
    this.fetcher = fetcher
  }
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    const token = this.tokens.getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (!this.baseUrl)
      throw new HttpError('API_NOT_CONFIGURED', 'Chưa cấu hình địa chỉ API (VITE_API_BASE_URL).')
    let response: Response
    try {
      response = await this.fetcher(new URL(path, this.baseUrl), { ...init, headers })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new HttpError('NETWORK_ERROR', 'Không thể kết nối API.', undefined, error)
    }
    if (!response.ok) {
      let details: unknown
      try {
        details = await response.json()
      } catch {
        details = undefined
      }
      if (response.status === 401) this.tokens.clearToken()
      // Backend trả lỗi dạng {"error": {"code", "message"}}
      const body = (details as { error?: { code?: string; message?: string } } | undefined)?.error
      throw new HttpError(
        body?.code ?? 'HTTP_ERROR',
        body?.message ?? `API trả về lỗi ${response.status}.`,
        response.status,
        details,
      )
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}
