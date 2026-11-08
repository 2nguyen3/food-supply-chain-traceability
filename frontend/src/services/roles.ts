import { Contract, isAddress, JsonRpcProvider, keccak256, toUtf8Bytes, ZeroHash } from 'ethers'
import { config } from '../config/env'
import abiFile from '../contracts/FoodTraceability.json'
import type { Role } from '../domain/types'

export class RolesError extends Error {}

// ADMIN_ROLE trùng DEFAULT_ADMIN_ROLE (0x00) trong hợp đồng
const ROLE_HASHES: [Role, string][] = [
  ['admin', ZeroHash],
  ['farmer', keccak256(toUtf8Bytes('FARMER_ROLE'))],
  ['logistics', keccak256(toUtf8Bytes('LOGISTICS_ROLE'))],
  ['retailer', keccak256(toUtf8Bytes('RETAILER_ROLE'))],
]

const READ_TIMEOUT_MS = 10000

/** Đọc vai trò hiện tại của ví trực tiếp từ hợp đồng (hasRole). Cơ sở dữ liệu không phải nguồn sự thật. */
export async function readRoles(address: string): Promise<Role[]> {
  if (!config.publicRpcUrl || !config.contractAddress || !isAddress(config.contractAddress))
    throw new RolesError('Thiếu cấu hình VITE_PUBLIC_RPC_URL hoặc VITE_CONTRACT_ADDRESS.')
  const provider = new JsonRpcProvider(config.publicRpcUrl, undefined, { batchMaxCount: 1 })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const contract = new Contract(config.contractAddress, abiFile.abi, provider)
    const checks = Promise.all(ROLE_HASHES.map(([, hash]) => contract.hasRole(hash, address)))
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), READ_TIMEOUT_MS)
    })
    const results = (await Promise.race([checks, timeout])) as boolean[]
    return ROLE_HASHES.filter((_, index) => results[index]).map(([role]) => role)
  } catch {
    throw new RolesError('Không đọc được vai trò từ blockchain. Kiểm tra mạng và thử lại.')
  } finally {
    if (timer) clearTimeout(timer)
    provider.destroy()
  }
}
