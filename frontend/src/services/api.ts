import { config } from '../config/env'
import { HttpClient, MemoryTokenProvider } from './http'

/** Token đăng nhập nằm trong bộ nhớ; phiên được lưu ở sessionStorage (xem sessionStore) để sống qua F5. */
export const tokens = new MemoryTokenProvider()

export const api = new HttpClient(config.apiBaseUrl ?? '', tokens)
