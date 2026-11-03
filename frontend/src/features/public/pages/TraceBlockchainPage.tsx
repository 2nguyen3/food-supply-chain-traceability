import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card, LoadingState } from '../../../components/ui'
import {
  inspectPublicChain,
  parseProductionTraceParams,
  type PublicReadStatus,
  type TraceParameterError,
} from '../services/publicChainReader'
import '../styles/trace-blockchain.css'

const PARAMETER_MESSAGES: Record<TraceParameterError, { title: string; description: string }> = {
  chainId: {
    title: 'Chain ID không hợp lệ',
    description: 'Chain ID trong đường dẫn phải là số nguyên không âm.',
  },
  network: {
    title: 'Mạng không được hỗ trợ',
    description: 'Đường dẫn truy xuất hiện chỉ hỗ trợ Ethereum Sepolia với chain ID 11155111.',
  },
  contractAddress: {
    title: 'Địa chỉ hợp đồng không hợp lệ',
    description: 'Địa chỉ hợp đồng phải là địa chỉ Ethereum 20 byte hợp lệ.',
  },
  tokenId: {
    title: 'Token ID không hợp lệ',
    description: 'Token ID phải là chuỗi số nguyên không âm; có thể lớn hơn giới hạn của Number.',
  },
}

const STATUS_MESSAGES: Record<
  PublicReadStatus['kind'],
  { title: string; description: string; connection: string; retry: boolean }
> = {
  unconfigured: {
    title: 'Chưa có dữ liệu Blockchain để truy xuất',
    description:
      'Cần cấu hình RPC Sepolia và địa chỉ hợp đồng COCOMARK đã triển khai trước khi có thể đọc lô thật.',
    connection: 'Chưa cấu hình',
    retry: false,
  },
  unsupportedContract: {
    title: 'Hợp đồng trong URL chưa được hỗ trợ',
    description:
      'Địa chỉ trong đường dẫn không khớp hợp đồng được cấu hình cho ứng dụng. Hãy kiểm tra lại mã QR hoặc URL.',
    connection: 'Chưa đọc dữ liệu',
    retry: false,
  },
  wrongNetwork: {
    title: 'RPC đang kết nối sai mạng',
    description:
      'RPC được cấu hình không trả về Ethereum Sepolia (11155111). Hãy kiểm tra cấu hình RPC rồi thử lại.',
    connection: 'Sai mạng',
    retry: true,
  },
  rpcTimeout: {
    title: 'RPC phản hồi quá lâu',
    description:
      'Không nhận được phản hồi từ RPC trong thời gian cho phép. Bạn có thể thử đọc lại.',
    connection: 'Hết thời gian chờ',
    retry: true,
  },
  rpcUnavailable: {
    title: 'Không đọc được RPC Sepolia',
    description:
      'Dịch vụ RPC không khả dụng hoặc trình duyệt không thể kết nối. Vui lòng thử lại sau.',
    connection: 'Kết nối thất bại',
    retry: true,
  },
  contractMissing: {
    title: 'Chưa tìm thấy hợp đồng tại địa chỉ này',
    description:
      'RPC Sepolia đã phản hồi, nhưng địa chỉ được cấu hình không có mã hợp đồng. Hãy kiểm tra bản triển khai.',
    connection: 'Đã kết nối Sepolia',
    retry: true,
  },
  abiMissing: {
    title: 'Chưa có dữ liệu Blockchain để truy xuất',
    description:
      'Đã kiểm tra mạng và địa chỉ có mã hợp đồng, nhưng dự án chưa có ABI COCOMARK để đọc token, sự kiện và tokenURI. Không thể xác nhận đây là hợp đồng COCOMARK.',
    connection: 'Đã kết nối Sepolia · chưa thể đọc lô',
    retry: false,
  },
  tokenMissing: {
    title: 'Không tìm thấy NFT này',
    description:
      'Token ID không tồn tại trong hợp đồng COCOMARK trên Sepolia. Hãy kiểm tra lại đường dẫn hoặc mã QR.',
    connection: 'Đã kết nối Sepolia · không tìm thấy token',
    retry: false,
  },
  metadataUnavailable: {
    title: 'Không tải được tokenURI hoặc metadata',
    description:
      'Đã đọc được tham chiếu từ hợp đồng nhưng không thể lấy hoặc kiểm tra cấu trúc metadata công khai. Vui lòng thử lại.',
    connection: 'Dữ liệu chưa đầy đủ',
    retry: true,
  },
  ipfsUnavailable: {
    title: 'Không truy cập được hồ sơ IPFS',
    description:
      'Gateway hoặc trình duyệt không thể tải tệp công khai. Không có kết quả SHA-256 nào được xác nhận cho các tệp này.',
    connection: 'Dữ liệu chưa đầy đủ',
    retry: true,
  },
  partialData: {
    title: 'Chỉ đọc được một phần dữ liệu lô',
    description:
      'Một số trường hoặc lịch sử chưa có sẵn. Trang chỉ có thể hiển thị các giá trị đã đọc và không tự điền dữ liệu còn thiếu.',
    connection: 'Dữ liệu chưa đầy đủ',
    retry: true,
  },
  hashMismatch: {
    title: 'SHA-256 không khớp',
    description:
      'Hash tính trên đúng byte của tệp gốc khác giá trị chuẩn. Không coi tệp này là đã xác minh; hãy kiểm tra nguồn hồ sơ.',
    connection: 'Kiểm chứng tệp thất bại',
    retry: true,
  },
}

type ReadState = { key: string; status: PublicReadStatus }

export function TraceBlockchainPage() {
  const { chainId, contractAddress, tokenId } = useParams()
  const parsed = useMemo(
    () => parseProductionTraceParams(chainId, contractAddress, tokenId),
    [chainId, contractAddress, tokenId],
  )
  const [attempt, setAttempt] = useState(0)
  const [readState, setReadState] = useState<ReadState | null>(null)
  const requestKey = `${chainId}/${contractAddress}/${tokenId}/${attempt}`
  const identity = parsed.identity

  useEffect(() => {
    if (!identity) return
    const controller = new AbortController()
    inspectPublicChain(identity, controller.signal).then(
      (status) => {
        if (!controller.signal.aborted) setReadState({ key: requestKey, status })
      },
      () => {
        if (!controller.signal.aborted)
          setReadState({ key: requestKey, status: { kind: 'rpcUnavailable' } })
      },
    )
    return () => controller.abort()
  }, [identity, requestKey])

  const loading = !!identity && readState?.key !== requestKey
  const status = !loading ? readState?.status : undefined
  const message = parsed.error
    ? PARAMETER_MESSAGES[parsed.error]
    : status
      ? STATUS_MESSAGES[status.kind]
      : undefined
  const connectionLabel = loading
    ? 'Đang kết nối RPC…'
    : parsed.error
      ? 'URL không hợp lệ'
      : status
        ? STATUS_MESSAGES[status.kind].connection
        : 'Chưa đọc dữ liệu'

  return (
    <div className="trace-blockchain-page">
      <div className="container trace-blockchain-container">
        <Link className="trace-blockchain-back" to="/trace">
          ‹ Tra cứu lô khác
        </Link>

        <div className="trace-blockchain-heading">
          <span className="trace-blockchain-eyebrow">Truy xuất công khai</span>
          <h1>Truy xuất nguồn gốc lô</h1>
          <p>Đường dẫn này dành cho dữ liệu Sepolia thật và có thể xem mà không cần kết nối ví.</p>
        </div>

        <Card className="trace-blockchain-identity" aria-label="Định danh Blockchain">
          <div className="trace-blockchain-network">
            <span className="trace-blockchain-network-dot" aria-hidden="true" />
            <span>Ethereum Sepolia</span>
            <small>{connectionLabel}</small>
          </div>
          <dl>
            <div>
              <dt>Chain ID</dt>
              <dd className="mono">{chainId || 'Thiếu tham số'}</dd>
            </div>
            <div>
              <dt>Địa chỉ hợp đồng</dt>
              <dd className="mono">{contractAddress || 'Thiếu tham số'}</dd>
            </div>
            <div>
              <dt>Token ID</dt>
              <dd className="mono">{tokenId || 'Thiếu tham số'}</dd>
            </div>
          </dl>
        </Card>

        <Card
          className={`trace-blockchain-state ${parsed.error ? 'trace-blockchain-state-error' : ''}`}
        >
          {loading ? (
            <>
              <div className="trace-blockchain-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <LoadingState label="Đang đọc thông tin mạng và hợp đồng từ Sepolia…" />
            </>
          ) : message ? (
            <div
              role={
                parsed.error ||
                (status && status.kind !== 'unconfigured' && status.kind !== 'abiMissing')
                  ? 'alert'
                  : 'status'
              }
            >
              <span className="trace-blockchain-state-mark" aria-hidden="true">
                {parsed.error ? '!' : 'i'}
              </span>
              <h2>{message.title}</h2>
              <p>{message.description}</p>
              {status?.kind === 'unconfigured' && (
                <p className="trace-blockchain-missing">
                  Cấu hình còn thiếu: <span className="mono">{status.missing.join(', ')}</span>
                </p>
              )}
              <div className="trace-blockchain-actions">
                {status && STATUS_MESSAGES[status.kind].retry && (
                  <Button type="button" onClick={() => setAttempt((value) => value + 1)}>
                    Thử lại
                  </Button>
                )}
                <Link className="button secondary" to="/trace">
                  Quay lại tra cứu
                </Link>
                <Link className="trace-blockchain-demo-link" to="/trace">
                  Xem lô mẫu tại trang tra cứu
                </Link>
              </div>
            </div>
          ) : null}
        </Card>

        <p className="trace-blockchain-footnote">
          Trang này không dùng fixture demo. Chưa có bản ghi lô, NFT, hồ sơ IPFS hoặc kết quả
          SHA-256 nào được xác nhận từ hợp đồng COCOMARK.
        </p>
      </div>
    </div>
  )
}
