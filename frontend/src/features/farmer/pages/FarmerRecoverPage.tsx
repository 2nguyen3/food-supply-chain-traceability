import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { Card, PageHeader } from '../../../components/ui'
import {
  bindDocument,
  describeApiError,
  listMyDocuments,
  type DocumentOut,
} from '../../../services/documentsApi'
import { HttpError } from '../../../services/http'
import { verifyRecoveryDocuments, type RecoveryMatch } from '../services/recoverDocuments'
import '../styles/farmer-recover.css'

const DOCUMENT_LABELS: Record<string, string> = {
  metadata: 'Metadata JSON',
  certificate: 'Chứng chỉ PDF',
  image: 'Ảnh lô hàng',
  invoice: 'Hóa đơn riêng',
  incident_report: 'Báo cáo sự cố',
  recall_reason: 'Lý do thu hồi',
}

export function FarmerRecoverPage() {
  const { session } = useSession()

  const sessionKey = [
    session?.source ?? 'none',
    session?.wallet.address.toLowerCase() ?? 'none',
    session?.wallet.chainId ?? 'none',
  ].join(':')

  return <FarmerRecoverContent key={sessionKey} />
}

function FarmerRecoverContent() {
  const { session } = useSession()
  const address = session?.wallet.address
  const realWallet = session?.source === 'chain'

  const activeRef = useRef(false)

  useEffect(() => {
    activeRef.current = true

    return () => {
      activeRef.current = false
    }
  }, [])

  const [documents, setDocuments] = useState<DocumentOut[]>([])
  const drafts = documents.filter((doc) => doc.status === 'draft')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState(
    '0xf7a1de2b5808554387367d15a1bac9640f784b4323e754817cf90dfc3d1e6a7e',
  )
  const [verifying, setVerifying] = useState(false)
  const [match, setMatch] = useState<RecoveryMatch | null>(null)
  const [verifyError, setVerifyError] = useState('')
  const [binding, setBinding] = useState(false)
  const [bindNotice, setBindNotice] = useState('')
  const [bindError, setBindError] = useState('')
  const [verifiedWallet, setVerifiedWallet] = useState('')

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [invoiceBinding, setInvoiceBinding] = useState(false)
  const [invoiceNotice, setInvoiceNotice] = useState('')
  const [invoiceError, setInvoiceError] = useState('')

  // Chỉ cho chọn invoice chưa gắn hoặc đã gắn đúng NFT hiện tại.
  const invoiceOptions = match
    ? documents.filter(
        (doc) =>
          doc.doc_type === 'invoice' &&
          doc.visibility === 'private' &&
          doc.uploader.toLowerCase() === address?.toLowerCase() &&
          ((doc.status === 'draft' && doc.token_id === null) ||
            (doc.status === 'bound' && doc.token_id === match.tokenId)),
      )
    : []

  const selectedInvoice = invoiceOptions.find((doc) => doc.id === selectedInvoiceId)

  const publicDocsBound =
    !!match &&
    [match.metadata, match.certificate, match.image].every(
      (doc) => doc.status === 'bound' && doc.token_id === match.tokenId,
    )

  async function verifyTransaction() {
    if (!address || !realWallet || status !== 'ready' || verifying || binding || invoiceBinding)
      return

    const wallet = address.toLowerCase()
    const hash = txHash.trim()

    setVerifying(true)
    setMatch(null)
    setVerifyError('')
    setBindNotice('')
    setBindError('')
    setVerifiedWallet('')
    setSelectedInvoiceId('')
    setInvoiceNotice('')
    setInvoiceError('')

    try {
      // Đọc trạng thái mới nhất từ backend.
      const latest = await listMyDocuments()

      // Không dùng kết quả khi trang hoặc phiên cũ đã bị hủy.
      if (!activeRef.current) return

      const result = await verifyRecoveryDocuments(hash, wallet, latest)

      if (!activeRef.current) return

      setDocuments(latest)
      setMatch(result)
      setVerifiedWallet(wallet)
    } catch (reason) {
      if (!activeRef.current) return

      setVerifyError(reason instanceof Error ? reason.message : 'Không thể xác minh giao dịch.')
    } finally {
      if (activeRef.current) {
        setVerifying(false)
      }
    }
  }

  async function bindVerifiedDocuments() {
    if (!match || !address || !realWallet || binding || verifiedWallet !== address.toLowerCase())
      return

    const jobs = [
      { label: 'Metadata', doc: match.metadata },
      { label: 'Chứng chỉ', doc: match.certificate },
      { label: 'Ảnh lô hàng', doc: match.image },
    ]

    const pending = jobs.filter(({ doc }) => doc.status === 'draft')

    if (pending.length === 0) {
      setBindNotice('Ba hồ sơ đã được gắn vào NFT này.')
      return
    }

    const confirmed = window.confirm(
      `Xác nhận gắn ${pending.length} hồ sơ vào NFT #${match.tokenId}` +
        ` (${match.batchCode})?\n\n` +
        'Thao tác chỉ cập nhật hồ sơ qua backend, không mint NFT mới.',
    )
    if (!confirmed) return

    setBinding(true)
    setBindNotice('')
    setBindError('')

    let newlyBound = 0

    try {
      for (const { label, doc } of jobs) {
        if (doc.status === 'bound') {
          if (doc.token_id !== match.tokenId) {
            throw new Error(`${label} đã gắn với NFT khác.`)
          }
          continue
        }

        if (doc.status !== 'draft' || doc.token_id !== null) {
          throw new Error(`Trạng thái ${label} không hợp lệ.`)
        }

        if (!activeRef.current) {
          throw new Error('Phiên khôi phục đã thay đổi.')
        }

        await bindDocument(doc.id, match.tokenId, match.txHash)
        newlyBound += 1

        setBindNotice(`Đã gắn ${newlyBound}/${pending.length} hồ sơ còn thiếu.`)
      }

      setBindNotice(`Hoàn thành: ba hồ sơ của NFT #${match.tokenId} ` + 'đã được xử lý thành công.')
    } catch (error) {
      const message =
        error instanceof HttpError
          ? describeApiError(error)
          : error instanceof Error
            ? error.message
            : 'Không xác định được nguyên nhân.'

      setBindError(
        `Quá trình gắn bị gián đoạn sau ${newlyBound} hồ sơ mới. ` +
          `${message} Hãy xác minh lại để tiếp tục, không mint lại NFT.`,
      )
    } finally {
      try {
        const latest = await listMyDocuments()
        setDocuments(latest)
      } catch {
        setBindError(
          'Không tải lại được trạng thái hồ sơ. ' +
            'Hãy tải lại trang và xác minh lại trước khi tiếp tục.',
        )
      }

      // Luôn xác minh lại với dữ liệu backend mới nhất.
      setMatch(null)
      setVerifiedWallet('')
      setBinding(false)
    }
  }

  async function bindSelectedInvoice() {
    if (
      !match ||
      !selectedInvoice ||
      !address ||
      !realWallet ||
      !publicDocsBound ||
      binding ||
      invoiceBinding ||
      verifying ||
      verifiedWallet !== address.toLowerCase()
    )
      return

    const invoice = selectedInvoice
    const target = match

    if (
      invoice.doc_type !== 'invoice' ||
      invoice.visibility !== 'private' ||
      invoice.uploader.toLowerCase() !== address.toLowerCase()
    ) {
      setInvoiceError('Hóa đơn không thuộc ví Farmer đang đăng nhập.')
      return
    }

    if (invoice.status === 'bound') {
      setInvoiceNotice(
        invoice.token_id === target.tokenId
          ? 'Hóa đơn này đã gắn vào đúng NFT.'
          : 'Hóa đơn này đã thuộc NFT khác.',
      )
      return
    }

    if (invoice.status !== 'draft' || invoice.token_id !== null) {
      setInvoiceError('Trạng thái hóa đơn không hợp lệ.')
      return
    }

    const confirmed = window.confirm(
      `Gắn hóa đơn ${invoice.id} vào NFT #${target.tokenId}` +
        ` (${target.batchCode})?\n\n` +
        'Hãy chắc chắn đây là hóa đơn của đúng lô hàng. ' +
        'Blockchain không lưu hash hóa đơn để tự đối chiếu.',
    )

    if (!confirmed) return

    setInvoiceBinding(true)
    setInvoiceError('')
    setInvoiceNotice('')

    try {
      if (!activeRef.current) return
      const result = await bindDocument(invoice.id, target.tokenId, target.txHash)

      if (result.status !== 'bound' || result.token_id !== target.tokenId) {
        throw new Error('Backend trả về trạng thái gắn không hợp lệ.')
      }

      setInvoiceNotice(`Đã gắn hóa đơn thành công vào NFT #${target.tokenId}.`)
    } catch (error) {
      setInvoiceError(
        error instanceof HttpError
          ? describeApiError(error)
          : error instanceof Error
            ? error.message
            : 'Không thể gắn hóa đơn.',
      )
    } finally {
      try {
        const latest = await listMyDocuments()
        setDocuments(latest)
      } catch {
        setInvoiceError(
          'Không tải lại được trạng thái hóa đơn. ' +
            'Hãy tải lại trang và xác minh lại trước khi thử tiếp.',
        )
      }

      setMatch(null)
      setVerifiedWallet('')
      setSelectedInvoiceId('')
      setInvoiceBinding(false)
    }
  }

  useEffect(() => {
    if (!address || !realWallet) return

    const controller = new AbortController()

    void listMyDocuments(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return
        setDocuments(result)
        setStatus('ready')
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return
        setError(describeApiError(reason))
        setStatus('error')
      },
    )

    return () => controller.abort()
  }, [address, realWallet])

  return (
    <div className="farmer-recover-page">
      <PageHeader
        title="Khôi phục hồ sơ lô NFT"
        description="Xem lại các hồ sơ đã tải lên nhưng chưa gắn vào NFT."
      />

      <Card>
        <h2>Khôi phục không cần mint lại</h2>

        <p>
          Trang này hỗ trợ Farmer tìm lại hồ sơ đã upload, đối chiếu với dữ liệu trên Blockchain và
          gắn các hồ sơ còn thiếu vào NFT đã tồn tại. Quá trình khôi phục không mint NFT mới và
          không yêu cầu ký thêm giao dịch Blockchain.
        </p>

        <Link to="/farmer/create">Quay lại trang tạo lô NFT</Link>
      </Card>

      <Card>
        <h2>Đối chiếu giao dịch đã mint</h2>
        <p>
          Nhập transaction hash của giao dịch tạo NFT. Thao tác này chỉ đọc Blockchain, không mint
          lại.
        </p>

        <div className="farmer-recover-verify">
          <label htmlFor="recovery-tx-hash">Transaction hash</label>
          <input
            id="recovery-tx-hash"
            disabled={verifying || binding || invoiceBinding}
            value={txHash}
            onChange={(event) => {
              setTxHash(event.target.value)
              setMatch(null)
              setVerifyError('')
            }}
            placeholder="0x..."
          />

          <button
            className="button"
            type="button"
            onClick={() => void verifyTransaction()}
            disabled={verifying || binding || invoiceBinding || status !== 'ready' || !realWallet}
          >
            {verifying ? 'Đang xác minh…' : 'Xác minh hồ sơ'}
          </button>
        </div>

        {verifyError && <p role="alert">{verifyError}</p>}

        {match && (
          <div className="farmer-recover-result">
            <h3>Đã tìm thấy hồ sơ khớp Blockchain</h3>
            <p>
              <strong>Mã lô:</strong> {match.batchCode}
            </p>
            <p>
              <strong>NFT:</strong> #{match.tokenId}
            </p>
            <p>
              <strong>Metadata:</strong> {match.metadata.id}
            </p>
            <p>
              <strong>Chứng chỉ:</strong> {match.certificate.id}
            </p>
            <p>
              <strong>Ảnh:</strong> {match.image.id}
            </p>

            <p>Metadata: {match.metadata.status === 'bound' ? 'Đã gắn' : 'Chờ gắn'}</p>
            <p>Chứng chỉ: {match.certificate.status === 'bound' ? 'Đã gắn' : 'Chờ gắn'}</p>
            <p>Ảnh lô: {match.image.status === 'bound' ? 'Đã gắn' : 'Chờ gắn'}</p>

            {[match.metadata, match.certificate, match.image].some(
              (doc) => doc.status === 'draft',
            ) ? (
              <button
                type="button"
                className="button"
                disabled={binding || !realWallet || verifiedWallet !== address?.toLowerCase()}
                onClick={() => void bindVerifiedDocuments()}
              >
                {binding ? 'Đang gắn hồ sơ…' : 'Gắn hồ sơ đã xác minh'}
              </button>
            ) : (
              <p>Ba hồ sơ đã được gắn vào NFT này.</p>
            )}
          </div>
        )}
        {bindNotice && <p role="status">{bindNotice}</p>}
        {bindError && <p role="alert">{bindError}</p>}

        {match && (
          <div className="farmer-recover-invoice">
            <h3>Gắn hóa đơn riêng</h3>
            <p>
              Hóa đơn không có hash trên Blockchain. Farmer cần chọn đúng bản đã upload trước khi
              gắn vào NFT.
            </p>

            {!publicDocsBound && (
              <p>Vui lòng gắn đủ metadata, chứng chỉ và ảnh trước khi gắn hóa đơn.</p>
            )}

            {invoiceOptions.length === 0 ? (
              <p>Không tìm thấy hóa đơn đã upload phù hợp với ví này.</p>
            ) : (
              <>
                <label htmlFor="recover-invoice-select">Hóa đơn đã upload</label>

                <select
                  id="recover-invoice-select"
                  value={selectedInvoiceId}
                  disabled={binding || invoiceBinding}
                  onChange={(event) => {
                    setSelectedInvoiceId(event.target.value)
                    setInvoiceError('')
                    setInvoiceNotice('')
                  }}
                >
                  <option value="">-- Chọn hóa đơn --</option>

                  {invoiceOptions.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {new Date(doc.created_at).toLocaleString('vi-VN')}
                      {' · '}
                      {doc.id.slice(0, 8)}
                      {' · '}
                      {doc.status === 'bound' ? 'Đã gắn' : 'Chờ gắn'}
                    </option>
                  ))}
                </select>

                {selectedInvoice && (
                  <div className="farmer-recover-invoice-detail">
                    <p>
                      <strong>Document ID:</strong> {selectedInvoice.id}
                    </p>

                    <p>
                      <strong>SHA-256:</strong> {selectedInvoice.sha256}
                    </p>

                    <p>
                      <strong>IPFS CID:</strong> {selectedInvoice.cid}
                    </p>

                    <p>
                      <strong>Ngày upload:</strong>{' '}
                      {new Date(selectedInvoice.created_at).toLocaleString('vi-VN')}
                    </p>

                    <p>
                      <strong>Trạng thái:</strong> {selectedInvoice.status}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  className="button"
                  disabled={
                    !publicDocsBound ||
                    !selectedInvoice ||
                    selectedInvoice.status !== 'draft' ||
                    binding ||
                    invoiceBinding ||
                    verifying ||
                    verifiedWallet !== address?.toLowerCase()
                  }
                  onClick={() => void bindSelectedInvoice()}
                >
                  {invoiceBinding ? 'Đang gắn hóa đơn…' : 'Gắn hóa đơn vào NFT'}
                </button>
              </>
            )}
          </div>
        )}

        {invoiceNotice && <p role="status">{invoiceNotice}</p>}
        {invoiceError && <p role="alert">{invoiceError}</p>}
      </Card>

      {!realWallet ? (
        <Card>
          <p>Hãy đăng nhập bằng ví Farmer thật để xem hồ sơ đã tải lên.</p>
        </Card>
      ) : status === 'loading' ? (
        <Card>
          <p>Đang tải hồ sơ từ backend…</p>
        </Card>
      ) : status === 'error' ? (
        <Card>
          <h2>Không thể tải hồ sơ</h2>
          <p role="alert">{error}</p>
        </Card>
      ) : drafts.length === 0 ? (
        <Card>
          <h2>Không có hồ sơ draft</h2>
          <p>Ví này hiện không có hồ sơ nào đang chờ gắn vào NFT.</p>
        </Card>
      ) : (
        <>
          <p>Tìm thấy {drafts.length} hồ sơ chưa gắn NFT.</p>

          <div className="farmer-recover-list">
            {drafts.map((doc) => (
              <Card key={doc.id}>
                <h2>{DOCUMENT_LABELS[doc.doc_type] ?? doc.doc_type}</h2>

                <dl className="farmer-recover-fields">
                  <dt>Document ID</dt>
                  <dd>{doc.id}</dd>

                  <dt>Trạng thái</dt>
                  <dd>{doc.status}</dd>

                  <dt>CID</dt>
                  <dd>{doc.cid}</dd>

                  <dt>SHA-256</dt>
                  <dd>{doc.sha256}</dd>

                  <dt>Ngày upload</dt>
                  <dd>{new Date(doc.created_at).toLocaleString('vi-VN')}</dd>
                </dl>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
