import { Contract, Interface, isAddress, JsonRpcProvider } from 'ethers'
import { config } from '../../../config/env'
import abiFile from '../../../contracts/FoodTraceability.json'
import type { DocumentOut } from '../../../services/documentsApi'

export interface RecoveryMatch {
  tokenId: string
  batchCode: string
  txHash: string
  metadata: DocumentOut
  certificate: DocumentOut
  image: DocumentOut
}

const iface = new Interface(abiFile.abi)
const normalizeHash = (value: string) => value.toLowerCase().replace(/^0x/, '')

function findRecoveryDocument(
  documents: DocumentOut[],
  type: 'metadata' | 'certificate' | 'image',
  hash: string,
  tokenId: string,
  cid?: string,
): DocumentOut {
  const matches = documents.filter(
    (doc) =>
      doc.doc_type === type &&
      normalizeHash(doc.sha256) === normalizeHash(hash) &&
      (cid === undefined || doc.cid === cid) &&
      ((doc.status === 'draft' && doc.token_id === null) ||
        (doc.status === 'bound' && doc.token_id === tokenId)),
  )

  // Nếu đã gắn đúng NFT, ưu tiên sử dụng hồ sơ đó.
  const bound = matches.filter((doc) => doc.status === 'bound')

  if (bound.length === 1) return bound[0]

  if (bound.length > 1) {
    throw new Error(
      `Có ${bound.length} hồ sơ ${type} đã gắn với NFT #${tokenId}. ` +
        'Cần kiểm tra trước khi tiếp tục.',
    )
  }

  if (matches.length === 0) {
    throw new Error(`Không tìm thấy hồ sơ ${type} khớp NFT #${tokenId}.`)
  }

  if (matches.length === 1) return matches[0]

  // Nhiều draft chỉ được coi là tương đương khi
  // cả SHA-256 lẫn CID đều giống nhau.
  const first = matches[0]

  const identical = matches.every(
    (doc) => normalizeHash(doc.sha256) === normalizeHash(first.sha256) && doc.cid === first.cid,
  )

  if (!identical) {
    throw new Error(
      `Có ${matches.length} hồ sơ ${type} trùng hash nhưng ` + 'khác CID. Cần kiểm tra thủ công.',
    )
  }

  // Các bản ghi có cùng nội dung: chọn bản upload mới nhất.
  // Document ID được dùng để sắp xếp ổn định nếu trùng thời gian.
  return [...matches].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id),
  )[0]
}

/** Chỉ đọc Blockchain và đối chiếu draft, không gửi giao dịch hay bind. */
export async function verifyRecoveryDocuments(
  txHash: string,
  farmerWallet: string,
  drafts: DocumentOut[],
): Promise<RecoveryMatch> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash))
    throw new Error('Transaction hash phải gồm 0x và 64 ký tự hex.')

  if (!config.publicRpcUrl || !config.contractAddress || !isAddress(config.contractAddress))
    throw new Error('Thiếu cấu hình RPC hoặc Smart Contract.')

  const provider = new JsonRpcProvider(config.publicRpcUrl, undefined, { batchMaxCount: 1 })

  try {
    const network = await provider.getNetwork()
    if (network.chainId !== BigInt(config.chainId))
      throw new Error('RPC không kết nối đến đúng mạng Blockchain.')

    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) throw new Error('Không tìm thấy biên nhận giao dịch.')

    if (receipt.status !== 1) throw new Error('Giao dịch không thành công.')

    const events = receipt.logs
      .filter((log) => log.address.toLowerCase() === config.contractAddress!.toLowerCase())
      .flatMap((log) => {
        try {
          const parsed = iface.parseLog({
            topics: log.topics,
            data: log.data,
          })
          return parsed?.name === 'BatchCreated' ? [parsed] : []
        } catch {
          return []
        }
      })

    if (events.length !== 1) throw new Error('Receipt không có đúng một sự kiện BatchCreated.')

    const event = events[0]
    const farmer = String(event.args.farmer)

    if (farmer.toLowerCase() !== farmerWallet.toLowerCase())
      throw new Error('Ví đang đăng nhập không phải Farmer tạo NFT.')

    const tokenId = BigInt(event.args.tokenId)
    const batchCode = String(event.args.batchCode)
    const metadataCID = String(event.args.metadataCID)
    const metadataHash = String(event.args.metadataHash)

    const contract = new Contract(config.contractAddress, abiFile.abi, provider)

    const batch = await contract.getBatch(tokenId)

    if (
      BigInt(batch.tokenId) !== tokenId ||
      String(batch.batchCode) !== batchCode ||
      normalizeHash(String(batch.metadataHash)) !== normalizeHash(metadataHash)
    )
      throw new Error('Dữ liệu lô không khớp sự kiện BatchCreated.')

    const ownedDrafts = drafts.filter(
      (doc) => doc.uploader.toLowerCase() === farmerWallet.toLowerCase(),
    )

    return {
      tokenId: tokenId.toString(),
      batchCode,
      txHash,

      metadata: findRecoveryDocument(
        ownedDrafts,
        'metadata',
        metadataHash,
        tokenId.toString(),
        metadataCID,
      ),
      certificate: findRecoveryDocument(
        ownedDrafts,
        'certificate',
        String(batch.certificateHash),
        tokenId.toString(),
      ),
      image: findRecoveryDocument(
        ownedDrafts,
        'image',
        String(batch.imageHash),
        tokenId.toString(),
      ),
    }
  } finally {
    provider.destroy()
  }
}
