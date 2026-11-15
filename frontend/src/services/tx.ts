import {
  BrowserProvider,
  Contract,
  Interface,
  isError,
  type ContractTransactionReceipt,
  type ContractTransactionResponse,
} from 'ethers'
import { config, networkName } from '../config/env'
import abiFile from '../contracts/FoodTraceability.json'
import { currentAccount, getEthereum, readChainId, toWalletError } from './wallet'

export type TxErrorKind = 'rejected' | 'reverted' | 'wallet' | 'precondition' | 'network' | 'unknown'

export class TxError extends Error {
  kind: TxErrorKind
  errorName?: string
  constructor(kind: TxErrorKind, message: string, errorName?: string) {
    super(message)
    this.kind = kind
    this.errorName = errorName
  }
}

const LOCK_REASONS = ['đã bán', 'đã hết hạn', 'đã bị thu hồi']

const REVERT_MESSAGES: Record<string, (args: readonly unknown[]) => string> = {
  FarmNotAssigned: () => 'Ví này chưa được Admin gán mã nông trại (farmId).',
  EmptyBatchCode: () => 'Mã lô không được để trống.',
  DuplicateBatchCode: () => 'Mã lô đã tồn tại trên blockchain.',
  InvalidQuantity: () => 'Khối lượng của lô phải đúng 1.000 kg.',
  InvalidDates: () => 'Ngày thu hoạch không được ở tương lai và hạn sử dụng phải sau hiện tại.',
  EmptyMetadata: () => 'Thiếu CID hoặc hash của hồ sơ.',
  BatchNotFound: () => 'Không tìm thấy lô trên blockchain.',
  NotTokenOwner: () => 'Bạn không phải chủ sở hữu hiện tại của lô này.',
  NotRecipient: () => 'Bạn không phải người nhận của yêu cầu bàn giao này.',
  NotSender: () => 'Chỉ người gửi yêu cầu bàn giao mới được hủy.',
  RoleNoLongerValid: () => 'Vai trò của một bên trong yêu cầu bàn giao không còn hợp lệ.',
  BatchLocked: (args) =>
    `Lô đã bị khóa (${LOCK_REASONS[Number(args[1])] ?? 'không còn thao tác được'}).`,
  InvalidRoute: () =>
    'Người nhận không hợp lệ. Tuyến cố định là Farmer → Logistics → Retailer, và người nhận phải có đúng vai trò.',
  PendingExists: () => 'Lô đang có một yêu cầu bàn giao chưa được xử lý.',
  NoActiveRequest: () => 'Lô không có yêu cầu bàn giao nào đang chờ.',
  StaleRequest: () => 'Yêu cầu bàn giao này đã cũ, hãy tải lại trang.',
  HashMismatch: () => 'Hash hồ sơ không khớp dữ liệu đã ghi khi tạo lô.',
  InvalidLifecycle: () => 'Trạng thái hiện tại của lô không cho phép thao tác này.',
  EmptyReport: () => 'Thiếu báo cáo sự cố.',
  UnknownIncident: () => 'Không tìm thấy sự cố này.',
  AlreadyRecalled: () => 'Lô đã bị thu hồi trước đó.',
  EmptyReason: () => 'Thiếu lý do thu hồi.',
  DirectTransferDisabled: () => 'Không chuyển NFT trực tiếp; hãy dùng yêu cầu bàn giao.',
  AccessControlUnauthorizedAccount: () => 'Ví của bạn chưa được cấp vai trò cần thiết cho thao tác này.',
}

function describeRevert(name: string, args: readonly unknown[]): string {
  return REVERT_MESSAGES[name]?.(args) ?? `Hợp đồng từ chối giao dịch (${name}).`
}

/** Chuẩn hóa mọi lỗi từ ví, RPC và hợp đồng về một dạng có thông điệp tiếng Việt. */
export function toTxError(error: unknown): TxError {
  if (error instanceof TxError) return error
  const code = (error as { code?: number | string })?.code
  if (code === 'ACTION_REJECTED' || code === 4001 || isError(error, 'ACTION_REJECTED'))
    return new TxError('rejected', 'Bạn đã từ chối ký giao dịch trong MetaMask.')
  const revert = (error as { revert?: { name?: string; args?: readonly unknown[] } })?.revert
  if (revert?.name) return new TxError('reverted', describeRevert(revert.name, revert.args ?? []), revert.name)
  if (isError(error, 'CALL_EXCEPTION'))
    return new TxError('reverted', 'Hợp đồng từ chối giao dịch. Kiểm tra lại điều kiện rồi thử lại.')
  if (isError(error, 'NETWORK_ERROR') || isError(error, 'SERVER_ERROR') || isError(error, 'TIMEOUT'))
    return new TxError('network', 'Không kết nối được blockchain. Hãy kiểm tra mạng rồi thử lại.')
  if (isError(error, 'INSUFFICIENT_FUNDS'))
    return new TxError('wallet', 'Ví không đủ ETH để trả phí giao dịch.')
  if (isError(error, 'NONCE_EXPIRED') || isError(error, 'REPLACEMENT_UNDERPRICED'))
    return new TxError(
      'wallet',
      'MetaMask báo sai số thứ tự giao dịch (nonce). Nếu vừa dựng lại mạng local, hãy xóa dữ liệu tab hoạt động của tài khoản trong MetaMask.',
    )
  const wallet = toWalletError(error)
  return new TxError(wallet.code === 'REJECTED' ? 'rejected' : 'wallet', wallet.message)
}

export interface TxProgress {
  /** Bắt đầu ước lượng phí và chờ người dùng ký trong ví. */
  onSigning?: () => void
  /** Đã ký và phát giao dịch lên mạng. */
  onBroadcast?: (hash: string) => void
}

/**
 * Gửi một giao dịch ghi lên hợp đồng bằng ví đã đăng nhập: kiểm đúng mạng và đúng tài khoản trước khi ký,
 * rồi chờ biên nhận. Từ chối ký, revert và lỗi mạng được phân biệt qua TxError.kind.
 */
export async function sendTransaction(
  expectedAddress: string,
  build: (contract: Contract) => Promise<ContractTransactionResponse>,
  progress: TxProgress = {},
): Promise<{ hash: string; receipt: ContractTransactionReceipt }> {
  const ethereum = getEthereum()
  if (!ethereum) throw new TxError('wallet', 'Chưa phát hiện MetaMask.')
  if (!config.contractAddress)
    throw new TxError('precondition', 'Chưa cấu hình địa chỉ hợp đồng (VITE_CONTRACT_ADDRESS).')

  let chainId: number
  try {
    chainId = await readChainId(ethereum)
  } catch (error) {
    throw toTxError(error)
  }
  if (chainId !== config.chainId)
    throw new TxError(
      'precondition',
      `MetaMask đang ở chainId ${chainId}. Hãy chuyển sang mạng ${networkName} (chainId ${config.chainId}).`,
    )
  const active = await currentAccount()
  if (!active || active.toLowerCase() !== expectedAddress.toLowerCase())
    throw new TxError(
      'precondition',
      'Tài khoản đang chọn trong MetaMask khác với tài khoản đã đăng nhập. Hãy chọn lại hoặc đăng nhập lại.',
    )

  try {
    const signer = await new BrowserProvider(ethereum).getSigner(expectedAddress)
    const contract = new Contract(config.contractAddress, abiFile.abi, signer)
    progress.onSigning?.()
    const response = await build(contract)
    progress.onBroadcast?.(response.hash)
    const receipt = await response.wait()
    if (!receipt || receipt.status !== 1)
      throw new TxError('reverted', 'Giao dịch đã được ghi nhưng bị hợp đồng revert.')
    return { hash: response.hash, receipt }
  } catch (error) {
    throw toTxError(error)
  }
}

const iface = new Interface(abiFile.abi)

/** Tìm sự kiện đã phát ra từ hợp đồng trong biên nhận và trả tham số có tên. */
export function findEvent(
  receipt: ContractTransactionReceipt,
  name: string,
): Record<string, unknown> | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.contractAddress?.toLowerCase()) continue
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name === name)
        return Object.fromEntries(parsed.fragment.inputs.map((input, i) => [input.name, parsed.args[i]]))
    } catch {
      // log của hợp đồng khác hoặc sự kiện không có trong ABI
    }
  }
  return null
}
