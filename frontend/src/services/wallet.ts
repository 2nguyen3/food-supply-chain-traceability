import { BrowserProvider, getAddress } from 'ethers'
import { config, networkName } from '../config/env'

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>
  on?(event: string, listener: (payload: unknown) => void): void
  removeListener?(event: string, listener: (payload: unknown) => void): void
  isMetaMask?: boolean
  providers?: Eip1193Provider[]
}

export type WalletErrorCode = 'NO_WALLET' | 'REJECTED' | 'PENDING' | 'SWITCH_FAILED' | 'FAILED'

export class WalletError extends Error {
  code: WalletErrorCode
  constructor(code: WalletErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/** Ví được tiêm vào trang; nếu có nhiều ví (providers) thì ưu tiên MetaMask. */
export function getEthereum(): Eip1193Provider | undefined {
  const injected = (window as Window & { ethereum?: Eip1193Provider }).ethereum
  if (!injected) return undefined
  return injected.providers?.find((provider) => provider.isMetaMask) ?? injected
}

function requireEthereum(): Eip1193Provider {
  const ethereum = getEthereum()
  if (!ethereum)
    throw new WalletError(
      'NO_WALLET',
      'Chưa phát hiện MetaMask. Hãy cài extension MetaMask rồi tải lại trang.',
    )
  return ethereum
}

function codeOf(error: unknown): number | string | undefined {
  const direct = (error as { code?: number | string })?.code
  const nested = (error as { info?: { error?: { code?: number } } })?.info?.error?.code
  // ethers bọc lỗi của ví: ACTION_REJECTED hoặc lỗi gốc nằm trong info.error
  return direct === 'UNKNOWN_ERROR' || direct === 'CALL_EXCEPTION' ? (nested ?? direct) : (direct ?? nested)
}

export function toWalletError(error: unknown): WalletError {
  if (error instanceof WalletError) return error
  const code = codeOf(error)
  if (code === 4001 || code === 'ACTION_REJECTED')
    return new WalletError('REJECTED', 'Bạn đã từ chối yêu cầu trong MetaMask.')
  if (code === -32002)
    return new WalletError(
      'PENDING',
      'MetaMask đang chờ bạn xác nhận một yêu cầu trước đó. Hãy mở extension MetaMask để hoàn tất.',
    )
  return new WalletError('FAILED', 'Không thể giao tiếp với MetaMask. Vui lòng thử lại.')
}

const parseChainId = (value: unknown) => Number.parseInt(String(value), 16)

export async function readChainId(ethereum: Eip1193Provider = requireEthereum()): Promise<number> {
  try {
    return parseChainId(await ethereum.request({ method: 'eth_chainId' }))
  } catch (error) {
    throw toWalletError(error)
  }
}

export async function connectWallet(): Promise<{ address: `0x${string}`; chainId: number }> {
  const ethereum = requireEthereum()
  try {
    const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[]
    if (!accounts?.[0]) throw new WalletError('FAILED', 'MetaMask không trả về địa chỉ ví.')
    return {
      address: getAddress(accounts[0]) as `0x${string}`,
      chainId: await readChainId(ethereum),
    }
  } catch (error) {
    throw toWalletError(error)
  }
}

/** Tài khoản đang được chọn trong ví (không bật hộp thoại xin quyền). */
export async function currentAccount(): Promise<`0x${string}` | null> {
  const ethereum = getEthereum()
  if (!ethereum) return null
  try {
    const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[]
    return accounts?.[0] ? (getAddress(accounts[0]) as `0x${string}`) : null
  } catch {
    return null
  }
}

const CHAIN_PARAMS: Record<number, Record<string, unknown>> = {
  31337: {
    chainName: networkName,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [config.publicRpcUrl ?? 'http://127.0.0.1:8545'],
  },
  11155111: {
    chainName: networkName,
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
}

/** Yêu cầu ví chuyển sang mạng cấu hình; chưa có mạng đó trong ví thì thêm vào. */
export async function switchToConfiguredChain(): Promise<void> {
  const ethereum = requireEthereum()
  const chainId = `0x${config.chainId.toString(16)}`
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
  } catch (error) {
    if (codeOf(error) !== 4902 || !CHAIN_PARAMS[config.chainId]) throw toSwitchError(error)
    try {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId, ...CHAIN_PARAMS[config.chainId] }],
      })
    } catch (addError) {
      throw toSwitchError(addError)
    }
  }
}

function toSwitchError(error: unknown): WalletError {
  const wallet = toWalletError(error)
  return wallet.code === 'FAILED'
    ? new WalletError('SWITCH_FAILED', `Không chuyển được sang mạng ${networkName}.`)
    : wallet
}

/** Ký thông điệp đăng nhập (personal_sign, EIP-191) bằng đúng tài khoản đã kết nối. */
export async function signLoginMessage(address: string, message: string): Promise<string> {
  const ethereum = requireEthereum()
  try {
    const signer = await new BrowserProvider(ethereum).getSigner(address)
    return await signer.signMessage(message)
  } catch (error) {
    throw toWalletError(error)
  }
}

/**
 * Ngắt kết nối trang web với ví (thu hồi quyền đọc tài khoản) để lần kết nối sau MetaMask hỏi chọn lại
 * tài khoản thay vì tự dùng tài khoản cũ. Ví không hỗ trợ thì bỏ qua: phiên của ứng dụng vẫn đã đóng.
 */
export async function disconnectWallet(): Promise<void> {
  try {
    await getEthereum()?.request({
      method: 'wallet_revokePermissions',
      params: [{ eth_accounts: {} }],
    })
  } catch {
    // không bắt buộc
  }
}

/** Lắng nghe đổi tài khoản và đổi mạng trong ví; trả hàm hủy đăng ký. */
export function subscribeWallet(handlers: {
  onAccounts: (accounts: string[]) => void
  onChain: (chainId: number) => void
}): () => void {
  const ethereum = getEthereum()
  if (!ethereum?.on) return () => {}
  const onAccounts = (payload: unknown) => handlers.onAccounts(Array.isArray(payload) ? payload : [])
  const onChain = (payload: unknown) => handlers.onChain(parseChainId(payload))
  ethereum.on('accountsChanged', onAccounts)
  ethereum.on('chainChanged', onChain)
  return () => {
    ethereum.removeListener?.('accountsChanged', onAccounts)
    ethereum.removeListener?.('chainChanged', onChain)
  }
}
