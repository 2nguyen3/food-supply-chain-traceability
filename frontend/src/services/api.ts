import { config } from '../config/env'
import { HttpClient, MemoryTokenProvider } from './http'

/** Token đăng nhập chỉ nằm trong bộ nhớ của tab (không localStorage); tải lại trang là phải đăng nhập lại. */
export const tokens = new MemoryTokenProvider()

export const api = new HttpClient(config.apiBaseUrl ?? '', tokens)
