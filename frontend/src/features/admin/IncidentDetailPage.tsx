import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, ErrorState, LoadingState, Modal, PageHeader } from '../../components/ui'
import { useToast } from '../../components/ui/toast'
import { TxProgressModal, type TxStepDef } from '../../components/TxProgressModal'
import { useSession } from '../../app/session'
import type { Role } from '../../domain/types'
import { useStepFlow } from '../../hooks/useStepFlow'
import { sha256Hex, toBytes32, utf8Bytes } from '../../lib/hash'
import { bindDocument, describeApiError, uploadDocument } from '../../services/documentsApi'
import { sendTransaction, TxError } from '../../services/tx'
import { ExplorerLink } from '../public/components/ExplorerLink'
import { ipfsFileUrl } from '../public/services/publicChainReader'
import {
  formatBytes,
  formatDate,
  formatTime,
  LIFECYCLE_PILL,
  shortAddress,
  shortHash,
} from './format'
import { useAdminChain } from './hooks/useAdminChain'
import {
  readAdminIncidentDetail,
  recallManifestPdf,
  type AdminArtifact,
  type AdminBatchRow,
  type AdminIncidentRow,
} from './services/adminChain'
import { TemperatureChart, type ChartReading } from './TemperatureChart'
import './styles/roles.css'
import './styles/batches.css'
import './styles/incidents.css'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const MIN_REASON_LENGTH = 10
const MAX_PDF_BYTES = 10 * 1024 * 1024
const TEMP_MIN = 8
const TEMP_MAX = 15

const ROLE_NAMES: Record<Role, string> = {
  admin: 'Admin',
  farmer: 'Farmer',
  logistics: 'Logistics',
  retailer: 'Retailer',
}

const TX_STEPS: TxStepDef[] = [
  {
    label: 'Kiểm tra dữ liệu',
    description: 'Sự cố tham chiếu, lý do và tệp PDF hợp lệ; ví đang đăng nhập là Admin.',
  },
  {
    label: 'Tải PDF lên IPFS',
    description: 'Backend kiểm nội dung, trả CID và SHA-256 trên đúng byte đã gửi.',
  },
  {
    label: 'Tạo manifest lý do',
    description: 'JSON chứa lý do và thông tin PDF, băm SHA-256 trên đúng byte tải lên.',
  },
  {
    label: 'Ký giao dịch',
    description: 'Xác nhận recallBatch trong MetaMask.',
  },
  {
    label: 'Chờ biên nhận',
    description: 'Đợi block xác nhận giao dịch thu hồi.',
  },
  {
    label: 'Gắn tài liệu PDF',
    description: 'bindDocument để hồ sơ lý do thuộc về lô.',
  },
]

type JourneyKind = 'mint' | 'transfer' | 'reading' | 'sold' | 'incident' | 'recall'

interface JourneyItem {
  id: string
  kind: JourneyKind
  title: string
  description: string
  time: string
  txHash: string
}

interface RecallOperation {
  batch: AdminBatchRow
  incidentId: number
  reason: string
  file: File
  sha256: string
}

interface BindPending {
  documentId: string
  tokenId: string
  batchCode: string
}

interface PreparedDocuments {
  pdfDocumentId: string
  pdfCid: string
  manifestCid: string
  manifestSha256: string
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AlertIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 2.8 20h18.4L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 9v5M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3 9.5h18M16.5 14.5h2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LeafIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 4c-8 0-14 3.5-14 10a6 6 0 0 0 6 6c6.5 0 8-6 8-16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M5 20c2.5-5 6-8 11-10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h11v10H3V6Zm11 3h4l3 3v4h-7V9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function ThermometerIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 14.5V6a2 2 0 1 1 4 0v8.5a4.5 4.5 0 1 1-4 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 9v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function StoreIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9V5h16v4M3 9h18l-1.5 3H4.5L3 9Zm1.5 3v7h15v-7M9 19v-4h6v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FlagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 21V4m0 0h11.5l-2 3.5 2 3.5H5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m6 18.5 11.5-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 3 5 13.5h5.5L10 21l8-10.5h-5.5L13 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 10.5v6M12 7.5h.01"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CopyButton({ text, message }: { text: string; message: string }) {
  const { showToast } = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      showToast(message, 'success')
    } catch {
      showToast('Không thể sao chép trên trình duyệt này', 'error')
    }
  }

  return (
    <button
      type="button"
      className="incident-copy"
      onClick={copy}
      aria-label={message}
      title={message}
    >
      <CopyIcon />
    </button>
  )
}

function WalletChip({
  label,
  address,
  copyMessage,
}: {
  label?: string
  address: string
  copyMessage: string
}) {
  return (
    <span className="incident-wallet-chip">
      <WalletIcon />
      {label && <strong>{label}</strong>}
      <span className="mono" title={address}>
        {shortAddress(address)}
      </span>
      <CopyButton text={address} message={copyMessage} />
    </span>
  )
}

function verifyLabel(artifact: AdminArtifact): {
  text: string
  tone: 'match' | 'mismatch' | 'unavailable'
} {
  if (artifact.verified === 'match') return { text: 'SHA-256 khớp hash trên chain', tone: 'match' }
  if (artifact.verified === 'mismatch')
    return { text: 'SHA-256 KHÔNG khớp hash trên chain', tone: 'mismatch' }
  return { text: 'Không tải được tệp để đối chiếu SHA-256', tone: 'unavailable' }
}

function ArtifactEvidence({
  label,
  artifact,
  jsonNote,
}: {
  label: string
  artifact: AdminArtifact
  jsonNote?: string
}) {
  const verify = verifyLabel(artifact)
  return (
    <div className="incident-evidence-row">
      <span className="incident-evidence-label">{label}</span>
      <div className="incident-evidence-body">
        <strong className="mono">
          {artifact.kind === 'pdf'
            ? 'PDF gốc'
            : artifact.kind === 'json'
              ? 'JSON'
              : 'Chưa xác định'}
        </strong>
        <span className="incident-hash-chip">
          CID <span className="mono break">{artifact.cid || '—'}</span>
          {artifact.cid && <CopyButton text={artifact.cid} message="Đã sao chép CID" />}
        </span>
        <span className="incident-hash-chip">
          ipfs://{' '}
          <span className="mono break">{artifact.cid ? `ipfs://${artifact.cid}` : '—'}</span>
        </span>
        <span className="incident-hash-chip">
          Gateway{' '}
          {artifact.cid ? (
            <a
              className="incident-file-link break"
              href={artifact.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {artifact.fileUrl}
            </a>
          ) : (
            '—'
          )}
        </span>
        <span className="incident-hash-chip">
          SHA-256 on-chain <span className="mono break">{artifact.expectedSha256 || '—'}</span>
          {artifact.expectedSha256 && (
            <CopyButton text={artifact.expectedSha256} message="Đã sao chép SHA-256" />
          )}
        </span>
        <span className="incident-hash-chip">
          SHA-256 tải về <span className="mono break">{artifact.computedSha256 ?? '—'}</span>
          {artifact.computedSha256 && (
            <CopyButton text={artifact.computedSha256} message="Đã sao chép SHA-256" />
          )}
        </span>
        <span className={`incident-verify ${verify.tone}`}>
          {verify.tone === 'match' ? <CheckIcon /> : <AlertIcon size={14} />}
          {verify.text}
        </span>
        {jsonNote && <span className="incident-json-note">{jsonNote}</span>}
      </div>
    </div>
  )
}

function roleText(address: string, labels: Record<string, Role[]>): string {
  const roles = labels[address] ?? []
  if (!roles.length) return 'Ví'
  return roles.map((role) => ROLE_NAMES[role]).join(' / ')
}

function partyText(address: string, labels: Record<string, Role[]>): string {
  if (address === ZERO_ADDRESS) return 'Hệ thống'
  return `${roleText(address, labels)} ${shortAddress(address)}`
}

export function IncidentDetailPage() {
  const { id = '' } = useParams()
  const { session } = useSession()
  const { showToast } = useToast()
  const flow = useStepFlow()
  const numericId = /^\d+$/.test(id) ? Number(id) : NaN
  const loadDetail = useCallback(
    (signal: AbortSignal) => readAdminIncidentDetail(numericId, signal),
    [numericId],
  )
  const { state, reload } = useAdminChain(loadDetail)

  const [recallTarget, setRecallTarget] = useState<AdminBatchRow | null>(null)
  const [incidentRef, setIncidentRef] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfSha, setPdfSha] = useState('')
  const [fileError, setFileError] = useState('')
  const [recallError, setRecallError] = useState('')
  const [operation, setOperation] = useState<RecallOperation | null>(null)
  const [bindPending, setBindPending] = useState<BindPending | null>(null)
  const [stage, setStage] = useState<'recall' | 'bind'>('recall')
  const prepared = useRef<PreparedDocuments | null>(null)

  const detail = state.kind === 'ready' ? state.data : null
  const incidents = detail?.incidents ?? []
  const trimmedReason = reason.trim()
  const reasonValid = trimmedReason.length >= MIN_REASON_LENGTH

  // Mở sẵn hộp thoại thu hồi khi được điều hướng từ trang chi tiết lô (?recall=tokenId).
  const [searchParams] = useSearchParams()
  const recallParam = searchParams.get('recall')
  const autoRecall = useRef(false)
  useEffect(() => {
    if (!detail || autoRecall.current || !recallParam) return
    const candidates = [
      detail.batch,
      ...detail.related,
      ...detail.sameFarmOtherGroup,
      ...detail.otherFarm,
    ]
    const target = candidates.find((row) => row.tokenId === recallParam && !row.recall)
    if (!target) return
    autoRecall.current = true
    openRecall(target)
    // openRecall chỉ phụ thuộc detail hiện tại; chỉ chạy một lần cho mỗi token được yêu cầu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, recallParam])

  const chartReadings: ChartReading[] = useMemo(
    () =>
      (detail?.readings ?? []).map((reading) => ({
        id: reading.readingId,
        temperatureC: reading.temperatureC,
        over: reading.temperatureC < TEMP_MIN || reading.temperatureC > TEMP_MAX,
      })),
    [detail],
  )

  const journey = useMemo<JourneyItem[]>(() => {
    if (!detail) return []
    const labels = detail.roleLabels
    const items: JourneyItem[] = []
    for (const step of detail.ownership) {
      items.push({
        id: `transfer-${step.txHash}`,
        kind: step.kind === 'mint' ? 'mint' : 'transfer',
        title: step.kind === 'mint' ? 'Mint NFT' : 'Bàn giao',
        description: `${partyText(step.from, labels)} → ${partyText(step.to, labels)}`,
        time: step.at,
        txHash: step.txHash,
      })
    }
    for (const reading of detail.readings) {
      items.push({
        id: `reading-${reading.readingId}`,
        kind: 'reading',
        title: 'Ghi nhận nhiệt độ',
        description: `${reading.temperatureC.toFixed(2)}°C tại ${reading.location} · quan sát ${formatTime(reading.observedAt)}`,
        time: reading.at,
        txHash: reading.txHash,
      })
    }
    if (detail.sold) {
      items.push({
        id: `sold-${detail.sold.txHash}`,
        kind: 'sold',
        title: 'Bán lô',
        description: `${partyText(detail.sold.retailer, labels)} đã bán lô.`,
        time: detail.sold.at,
        txHash: detail.sold.txHash,
      })
    }
    if (detail.incident.txHash) {
      items.push({
        id: `incident-${detail.incident.incidentId}`,
        kind: 'incident',
        title: 'Báo cáo sự cố',
        description: `${partyText(detail.incident.reporter, labels)} báo cáo sự cố #${detail.incident.incidentId}.`,
        time: detail.incident.reportedAt,
        txHash: detail.incident.txHash,
      })
    }
    if (detail.batch.recall) {
      items.push({
        id: `recall-${detail.batch.recall.txHash}`,
        kind: 'recall',
        title: 'Thu hồi lô',
        description: `${partyText(detail.batch.recall.admin, labels)} thu hồi theo sự cố #${detail.batch.recall.incidentId}.`,
        time: detail.batch.recall.at,
        txHash: detail.batch.recall.txHash,
      })
    }
    items.sort((x, y) => Date.parse(x.time) - Date.parse(y.time))
    return items
  }, [detail])

  function openRecall(batch: AdminBatchRow) {
    setRecallTarget(batch)
    setIncidentRef(detail?.incident.incidentId ?? null)
    setReason('')
    setPdfFile(null)
    setPdfSha('')
    setFileError('')
    setRecallError('')
    prepared.current = null
  }

  function closeRecall() {
    setRecallTarget(null)
    setRecallError('')
    setFileError('')
  }

  async function pickPdf(file: File | null) {
    setFileError('')
    setRecallError('')
    setPdfFile(null)
    setPdfSha('')
    if (!file) return
    if (file.size > MAX_PDF_BYTES) {
      setFileError('Tệp vượt quá 10 MB.')
      return
    }
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (String.fromCharCode(...head) !== '%PDF-') {
      setFileError('Tệp không phải PDF hợp lệ (thiếu chữ ký %PDF-).')
      return
    }
    setPdfFile(file)
    setPdfSha(await sha256Hex(file))
  }

  function startRecall() {
    if (!recallTarget || !detail) return
    if (!reasonValid) {
      setRecallError(`Lý do thu hồi cần ít nhất ${MIN_REASON_LENGTH} ký tự.`)
      return
    }
    if (!pdfFile || !pdfSha) {
      setRecallError('Cần chọn tệp PDF lý do thu hồi.')
      return
    }
    if (!incidentRef || !incidents.some((incident) => incident.incidentId === incidentRef)) {
      setRecallError('Sự cố tham chiếu không tồn tại trên chain.')
      return
    }
    const op: RecallOperation = {
      batch: recallTarget,
      incidentId: incidentRef,
      reason: trimmedReason,
      file: pdfFile,
      sha256: pdfSha,
    }
    setRecallTarget(null)
    setRecallError('')
    setOperation(op)
    setStage('recall')
    setBindPending(null)
    prepared.current = null
    void runRecall(op)
  }

  async function runRecall(op: RecallOperation) {
    flow.start()
    try {
      if (!session || session.source !== 'chain')
        throw new TxError('precondition', 'Cần đăng nhập bằng ví thật để ký giao dịch.')

      let preparedDocs = prepared.current
      if (!preparedDocs) {
        flow.goTo(1)
        const pdfDoc = await uploadDocument(op.file, op.file.name, 'recall_reason')
        if (pdfDoc.sha256.toLowerCase() !== op.sha256.toLowerCase())
          throw new Error(
            'SHA-256 của PDF do máy chủ trả về không khớp hash tính trên tệp đã chọn. Không gửi giao dịch.',
          )

        flow.goTo(2)
        const manifest = {
          kind: 'cocomark.recall-reason',
          version: 1,
          tokenId: op.batch.tokenId,
          batchCode: op.batch.batchCode,
          incidentId: op.incidentId,
          reasonText: op.reason,
          pdf: {
            cid: pdfDoc.cid,
            sha256: op.sha256,
            name: op.file.name,
            sizeBytes: op.file.size,
          },
        }
        const manifestBytes = utf8Bytes(JSON.stringify(manifest))
        const manifestSha = await sha256Hex(manifestBytes)
        const manifestDoc = await uploadDocument(
          new Blob([manifestBytes], { type: 'application/json' }),
          `recall-reason-${op.batch.batchCode}.json`,
          'recall_reason',
        )
        if (manifestDoc.sha256.toLowerCase() !== manifestSha.toLowerCase())
          throw new Error(
            'SHA-256 của manifest do máy chủ trả về không khớp byte đã tải lên. Không gửi giao dịch.',
          )
        preparedDocs = {
          pdfDocumentId: pdfDoc.id,
          pdfCid: pdfDoc.cid,
          manifestCid: manifestDoc.cid,
          manifestSha256: manifestSha,
        }
        prepared.current = preparedDocs
      }

      flow.goTo(3)
      await sendTransaction(
        session.wallet.address,
        (contract) =>
          contract.recallBatch(
            BigInt(op.batch.tokenId),
            BigInt(op.incidentId),
            preparedDocs.manifestCid,
            toBytes32(preparedDocs.manifestSha256),
          ),
        {
          onSigning: () => flow.goTo(3),
          onBroadcast: (hash) => {
            flow.setTxHash(hash)
            flow.goTo(4)
          },
        },
      )
      flow.goTo(5)
      reload()
      try {
        await bindDocument(preparedDocs.pdfDocumentId, op.batch.tokenId)
        flow.succeed()
        showToast(`Đã thu hồi ${op.batch.batchCode} và gắn tệp lý do`, 'success')
      } catch (error) {
        setStage('bind')
        setBindPending({
          documentId: preparedDocs.pdfDocumentId,
          tokenId: op.batch.tokenId,
          batchCode: op.batch.batchCode,
        })
        flow.fail(
          `Giao dịch thu hồi đã thành công trên blockchain nhưng chưa hoàn tất liên kết tài liệu. ${describeApiError(error)}`,
        )
        showToast('Thu hồi thành công nhưng chưa gắn được tài liệu lý do', 'error')
      }
    } catch (error) {
      if (error instanceof TxError) flow.fail(error.message, error.kind === 'rejected')
      else if (error instanceof Error && error.message.includes('SHA-256')) flow.fail(error.message)
      else flow.fail(describeApiError(error))
    }
  }

  async function retryBind() {
    if (!bindPending) return
    flow.start()
    flow.goTo(5)
    try {
      await bindDocument(bindPending.documentId, bindPending.tokenId)
      flow.succeed()
      setBindPending(null)
      showToast(`Đã gắn tệp lý do cho ${bindPending.batchCode}`, 'success')
    } catch (error) {
      flow.fail(
        `Giao dịch thu hồi đã thành công trên blockchain nhưng chưa hoàn tất liên kết tài liệu. ${describeApiError(error)}`,
      )
    }
  }

  function closeProgress() {
    setOperation(null)
    flow.reset()
  }

  if (Number.isNaN(numericId)) {
    return (
      <div className="incidents-page">
        <PageHeader
          title="Không tìm thấy sự cố"
          description="Mã sự cố phải là số nguyên dương."
          crumbs={[{ label: 'Sự cố', to: '/admin/incidents' }]}
        />
        <Link className="button" to="/admin/incidents">
          Quay lại danh sách sự cố
        </Link>
      </div>
    )
  }

  if (state.kind === 'loading') {
    return (
      <div className="incidents-page">
        <LoadingState label={`Đang truy ngược sự cố #${numericId} từ blockchain…`} />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="incidents-page">
        <PageHeader
          title={`Sự cố #${numericId}`}
          crumbs={[{ label: 'Sự cố', to: '/admin/incidents' }]}
        />
        <ErrorState
          title={
            state.message.includes('Không tìm thấy')
              ? 'Không tìm thấy sự cố'
              : 'Không đọc được sự cố'
          }
          description={state.message}
          action={
            <Link className="button" to="/admin/incidents">
              Quay lại danh sách sự cố
            </Link>
          }
        />
      </div>
    )
  }

  if (!detail) return null

  const { incident, batch, report } = detail
  const recall = batch.recall
  const manifestPdf = recallManifestPdf(detail.recallArtifact, recall)
  const overReadings = chartReadings.filter((reading) => reading.over)
  const maxTemp = detail.readings.length
    ? Math.max(...detail.readings.map((reading) => reading.temperatureC))
    : null

  const relatedRows: {
    batch: AdminBatchRow
    classification: 'candidate' | 'control'
    note: string
  }[] = [
    ...detail.related.map((row) => ({
      batch: row,
      classification: 'candidate' as const,
      note: 'Cùng farmId + harvestGroupId: diện xem xét.',
    })),
    ...detail.sameFarmOtherGroup.map((row) => ({
      batch: row,
      classification: 'control' as const,
      note: 'Cùng farmId, khác harvestGroupId: đối chứng.',
    })),
    ...detail.otherFarm.map((row) => ({
      batch: row,
      classification: 'control' as const,
      note: 'Khác farmId: đối chứng.',
    })),
  ]

  function statusCell(row: AdminBatchRow) {
    return (
      <span className="incident-status-group">
        <span className={`batch-status ${row.lifecycle.toLowerCase()}`}>
          {LIFECYCLE_PILL[row.lifecycle]}
        </span>
        {row.expired && <span className="batch-status expired">Đã hết hạn</span>}
        {row.recalled && (
          <span className="batch-status recalled">
            <AlertIcon size={14} />
            Đã thu hồi
          </span>
        )}
      </span>
    )
  }

  function actionCell(row: AdminBatchRow, classification: 'candidate' | 'control') {
    if (classification === 'control')
      return <span className="incident-no-action">Đối chứng, không tự thu hồi</span>
    if (row.recall)
      return (
        <span className="incident-action-done">
          <span className="incident-done-label">
            <CheckIcon />
            Đã thu hồi
          </span>
          <span className="incident-done-tx">
            <ExplorerLink kind="tx" value={row.recall.txHash}>
              {shortHash(row.recall.txHash)}
            </ExplorerLink>
            <CopyButton text={row.recall.txHash} message="Đã sao chép mã giao dịch" />
          </span>
        </span>
      )
    return (
      <Button variant="danger" className="incident-recall-btn" onClick={() => openRecall(row)}>
        <BanIcon />
        Thu hồi lô này
      </Button>
    )
  }

  function primaryRecallAction() {
    if (batch.recall) return null
    return (
      <Button variant="danger" className="incident-recall-btn" onClick={() => openRecall(batch)}>
        <BanIcon />
        Thu hồi lô báo sự cố
      </Button>
    )
  }

  return (
    <div className="incidents-page incident-detail-page">
      <PageHeader
        title={`Điều tra sự cố #${incident.incidentId} · ${batch.batchCode}`}
        description="Ứng viên khớp theo farmId và harvestGroupId chỉ để điều tra, không phải bằng chứng nhiễm bẩn. Thu hồi từng lô một."
        crumbs={[{ label: 'Sự cố', to: '/admin/incidents' }, { label: `#${incident.incidentId}` }]}
      />

      <div className="incident-head-pills">
        <span className={`batch-status ${batch.lifecycle.toLowerCase()}`}>
          {LIFECYCLE_PILL[batch.lifecycle]}
        </span>
        {batch.expired && <span className="batch-status expired">Đã hết hạn</span>}
        {batch.recalled && (
          <span className="batch-status recalled">
            <AlertIcon size={14} />
            Đã thu hồi
          </span>
        )}
      </div>

      {bindPending && (
        <div className="incident-warning" role="alert">
          <span className="incident-warning-icon">
            <AlertIcon size={22} />
          </span>
          <div>
            <strong>Thu hồi đã thành công nhưng chưa gắn tài liệu</strong>
            <p>
              Giao dịch thu hồi {bindPending.batchCode} đã được ghi trên blockchain. Tệp PDF lý do
              chưa liên kết được vào lô; bấm nút để thử gắn lại, không cần gửi lại recallBatch.
            </p>
            <Button variant="secondary" onClick={() => void retryBind()}>
              Gắn lại tài liệu PDF
            </Button>
          </div>
        </div>
      )}

      <div className="incident-detail">
        <div className="incident-main">
          <section className="batch-card incident-report">
            <div className="incident-card-head">
              <h2>Báo cáo của Retailer</h2>
              <span className="batch-tx">
                {incident.txHash ? (
                  <>
                    tx{' '}
                    <ExplorerLink kind="tx" value={incident.txHash}>
                      {shortHash(incident.txHash)}
                    </ExplorerLink>
                    <CopyButton text={incident.txHash} message="Đã sao chép mã giao dịch" />
                  </>
                ) : (
                  'Không có event IncidentReported'
                )}
              </span>
            </div>

            {detail.description ? (
              <p className="incident-banner">{detail.description}</p>
            ) : report.kind === 'pdf' ? (
              <p className="incident-banner muted">
                Báo cáo là tệp PDF gốc. Nội dung không được trích xuất tự động; mở tệp bên dưới để
                đọc bản gốc.
              </p>
            ) : report.kind === 'json' ? (
              <p className="incident-banner muted">
                Báo cáo JSON không có trường mô tả dạng văn bản. Mở tệp gốc bên dưới để xem đầy đủ.
              </p>
            ) : (
              <p className="incident-banner muted">
                Chưa tải được báo cáo từ IPFS. CID và hash vẫn đọc từ chain.
              </p>
            )}

            <div className="incident-meta-grid">
              <div>
                <span>Lô</span>
                <strong>
                  <Link to={`/admin/batches/${batch.batchCode}`}>
                    {batch.batchCode} · #{batch.tokenId}
                  </Link>
                </strong>
              </div>
              <div>
                <span>Người báo</span>
                <WalletChip address={incident.reporter} copyMessage="Đã sao chép địa chỉ ví" />
              </div>
              <div>
                <span>Thời gian báo cáo</span>
                <strong>{formatTime(incident.reportedAt)}</strong>
              </div>
              <div>
                <span>Farmer tạo lô</span>
                {batch.farmer ? (
                  <WalletChip address={batch.farmer} copyMessage="Đã sao chép địa chỉ ví" />
                ) : (
                  <strong>Không có trong event</strong>
                )}
              </div>
              <div>
                <span>farmId</span>
                <strong>{batch.farmId}</strong>
              </div>
              <div>
                <span>harvestGroupId</span>
                <strong>{batch.harvestGroupId}</strong>
              </div>
              <div>
                <span>Ngày thu hoạch</span>
                <strong>{formatDate(batch.harvestDate)}</strong>
              </div>
              <div>
                <span>Hạn sử dụng</span>
                <strong>{formatDate(batch.expiryDate)}</strong>
              </div>
            </div>

            <div className="incident-evidence">
              <h3>Bằng chứng</h3>
              <ArtifactEvidence label="Báo cáo sự cố" artifact={report} />
            </div>

            {primaryRecallAction() && (
              <div className="incident-primary-action">{primaryRecallAction()}</div>
            )}
          </section>

          <section className="batch-card incident-related">
            <div className="incident-card-head">
              <div>
                <h2>Truy ngược lô liên quan</h2>
                <p className="incident-sub">
                  Ứng viên: cùng <strong>{batch.farmId}</strong> và cùng{' '}
                  <strong>{batch.harvestGroupId}</strong>. Danh sách chỉ để xem xét, chưa kết luận
                  nhiễm khuẩn. Các lô khác là đối chứng và không tự động bị thu hồi.
                </p>
              </div>
            </div>

            <div className="incident-table-wrap">
              <table className="incident-table">
                <thead>
                  <tr>
                    <th>LÔ</th>
                    <th>FARM / NHÓM</th>
                    <th>PHÂN LOẠI</th>
                    <th>TRẠNG THÁI</th>
                    <th>HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedRows.map(({ batch: row, classification, note }) => (
                    <tr key={row.tokenId} className={row.recalled ? 'recalled-row' : ''}>
                      <td>
                        <Link
                          className="incident-batch-link"
                          to={`/admin/batches/${row.batchCode}`}
                        >
                          {row.batchCode}
                        </Link>
                      </td>
                      <td className="incident-farmcell">
                        {row.farmId} / {row.harvestGroupId}
                      </td>
                      <td>
                        <span className={`incident-class ${classification}`}>
                          {classification === 'candidate' ? 'Cùng farm + nhóm' : 'Đối chứng'}
                        </span>
                        <span className="incident-class-note">{note}</span>
                      </td>
                      <td>{statusCell(row)}</td>
                      <td>{actionCell(row, classification)}</td>
                    </tr>
                  ))}
                  {relatedRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="incidents-empty">
                        Không có lô nào khác trên chain để đối chiếu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="incident-warning">
            <span className="incident-warning-icon">
              <AlertIcon size={22} />
            </span>
            <div>
              <strong>Lưu ý khi thu hồi</strong>
              <p>
                Thu hồi đánh dấu đúng lô được chọn, không xóa trạng thái Sold hay lịch sử NFT và
                không thu hồi cả trang trại. Chỉ thu hồi lô khác khi có căn cứ; đối chứng chỉ để so
                sánh.
              </p>
            </div>
          </div>
        </div>

        <aside className="incident-side">
          <section className="batch-card incident-recall-status">
            <h2>Trạng thái thu hồi</h2>
            {recall ? (
              <>
                <span className="batch-status recalled">
                  <AlertIcon size={14} />
                  Đã thu hồi
                </span>
                <div className="incident-recall-meta">
                  <div>
                    <span>Thời gian</span>
                    <strong>{formatTime(recall.at)}</strong>
                  </div>
                  <div>
                    <span>Giao dịch</span>
                    <span className="batch-tx">
                      <ExplorerLink kind="tx" value={recall.txHash}>
                        {shortHash(recall.txHash)}
                      </ExplorerLink>
                      <CopyButton text={recall.txHash} message="Đã sao chép mã giao dịch" />
                    </span>
                  </div>
                  <div>
                    <span>Sự cố tham chiếu</span>
                    <strong>
                      <Link to={`/admin/incidents/${recall.incidentId}`}>#{recall.incidentId}</Link>
                    </strong>
                  </div>
                  <div>
                    <span>Admin thực hiện</span>
                    <WalletChip address={recall.admin} copyMessage="Đã sao chép địa chỉ ví" />
                  </div>
                  <div>
                    <span>Lý do thu hồi</span>
                    {detail.recallReasonText ? (
                      <p>{detail.recallReasonText}</p>
                    ) : detail.recallArtifact?.kind === 'pdf' ? (
                      <p>
                        Tệp PDF gốc, không trích xuất văn bản tự động. Mở tệp bên dưới để đọc lý do.
                      </p>
                    ) : (
                      <p>Không đọc được manifest lý do từ IPFS; CID và hash vẫn đọc từ chain.</p>
                    )}
                  </div>
                  {manifestPdf && (
                    <div>
                      <span>Tệp PDF lý do</span>
                      <span className="incident-hash-chip">
                        <a
                          className="incident-file-link break"
                          href={ipfsFileUrl(manifestPdf.cid)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {manifestPdf.name}
                        </a>
                      </span>
                      <span className="incident-hash-chip">
                        SHA-256 khai báo <span className="mono break">{manifestPdf.sha256}</span>
                        <CopyButton text={manifestPdf.sha256} message="Đã sao chép SHA-256" />
                      </span>
                    </div>
                  )}
                </div>
                {detail.recallArtifact && (
                  <div className="incident-evidence">
                    <h3>Bằng chứng thu hồi</h3>
                    <ArtifactEvidence
                      label="Lý do thu hồi trên chain"
                      artifact={detail.recallArtifact}
                      jsonNote={
                        detail.recallReasonText
                          ? 'Manifest JSON hợp lệ: lý do đọc từ trường reasonText, PDF gốc liên kết ở trên.'
                          : undefined
                      }
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="batch-status incident-recall-pending">Chưa thu hồi</span>
                <p className="incident-recall-note">
                  Thu hồi từng lô, lý do tối thiểu {MIN_REASON_LENGTH} ký tự và bắt buộc có tệp PDF.
                  Không xoá lịch sử sự kiện hay quyền sở hữu NFT.
                </p>
              </>
            )}
          </section>

          <section className="batch-card incident-recall-status">
            <h2>Số liệu truy ngược</h2>
            <div className="incident-recall-meta">
              <div>
                <span>Thời gian đọc</span>
                <strong>{detail.metrics.durationMs} ms</strong>
              </div>
              <div>
                <span>Số lần gọi RPC</span>
                <strong>{detail.metrics.rpcCalls}</strong>
              </div>
              <div>
                <span>Số event đã giải mã</span>
                <strong>{detail.metrics.events}</strong>
              </div>
              <div>
                <span>Số reading</span>
                <strong>{detail.readings.length}</strong>
              </div>
            </div>
          </section>
        </aside>

        <section className="batch-card batch-timeline incident-timeline">
          <h2>Hành trình của {batch.batchCode}</h2>
          {journey.length === 0 ? (
            <p className="incident-recall-note">Chưa có event hành trình trên chain.</p>
          ) : (
            <ol>
              {journey.map((event) => (
                <li key={event.id} className={`journey-item ${event.kind}`}>
                  <span className="journey-icon">
                    {event.kind === 'mint' && <LeafIcon />}
                    {event.kind === 'transfer' && <TruckIcon />}
                    {event.kind === 'reading' && <ThermometerIcon />}
                    {event.kind === 'sold' && <StoreIcon />}
                    {event.kind === 'incident' && <FlagIcon />}
                    {event.kind === 'recall' && <AlertIcon size={17} />}
                  </span>
                  <div className="journey-body">
                    <strong>{event.title}</strong>
                    <p>{event.description}</p>
                    <span className="journey-meta">
                      {formatTime(event.time)} ·{' '}
                      <span className="batch-tx">
                        <ExplorerLink kind="tx" value={event.txHash}>
                          {shortHash(event.txHash)}
                        </ExplorerLink>
                        <CopyButton text={event.txHash} message="Đã sao chép mã giao dịch" />
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="incident-temp-section">
        <div className="incident-temp-col">
          <section className="batch-card incident-temp-card">
            <h2>Nhiệt độ vận chuyển</h2>
            {chartReadings.length > 0 ? (
              <TemperatureChart readings={chartReadings} min={TEMP_MIN} max={TEMP_MAX} />
            ) : (
              <p className="incident-temp-note">Lô này chưa có reading nào trên chain.</p>
            )}
            <p className="incident-temp-note">
              Ngưỡng tham chiếu {TEMP_MIN}–{TEMP_MAX}°C. Dữ liệu đọc từ event TransitRecorded; số
              nguyên centi°C được chia 100 để hiển thị.
            </p>
          </section>

          <section className="batch-card incident-over-temp">
            <div className="incident-over-temp-head">
              <span className="incident-over-temp-icon">
                <AlertIcon size={20} />
              </span>
              <div>
                <strong>
                  {overReadings.length > 0
                    ? `Vượt ngưỡng nhiệt độ: ${overReadings.length} reading`
                    : 'Không có reading vượt ngưỡng'}
                </strong>
                <p>
                  {overReadings.length > 0
                    ? `Có ${overReadings.length}/${chartReadings.length} reading ngoài khoảng ${TEMP_MIN}–${TEMP_MAX}°C${
                        maxTemp !== null ? `; cao nhất ${maxTemp.toFixed(2)}°C` : ''
                      }. Đây là dữ liệu đo, không phải kết luận nhiễm khuẩn.`
                    : 'Mọi reading trên chain nằm trong khoảng tham chiếu; vẫn cần đối chiếu báo cáo và lô liên quan.'}
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="batch-card incident-readings">
          <div className="incident-readings-wrap">
            <table className="incident-readings-table">
              <thead>
                <tr>
                  <th>READINGID</th>
                  <th>NHIỆT ĐỘ</th>
                  <th>OBSERVEDAT (THỜI ĐIỂM)</th>
                </tr>
              </thead>
              <tbody>
                {detail.readings.map((reading) => {
                  const over = reading.temperatureC < TEMP_MIN || reading.temperatureC > TEMP_MAX
                  return (
                    <tr key={reading.readingId} className={over ? 'over' : ''}>
                      <td className="mono">#{reading.readingId}</td>
                      <td>
                        {over && (
                          <span className="incident-reading-flag">
                            <AlertIcon size={14} />
                          </span>
                        )}
                        <span className={`incident-reading-temp${over ? ' over' : ''}`}>
                          {reading.temperatureC.toFixed(2)}°C
                        </span>
                        <span className="incident-reading-centi">
                          ({Math.round(reading.temperatureC * 100)} centi°C)
                          {over && ' · ngoài ngưỡng'}
                        </span>
                      </td>
                      <td>
                        <span>{formatTime(reading.observedAt)}</span>
                        <em>{reading.location}</em>
                        <span className="incident-reading-tx">
                          <ExplorerLink kind="tx" value={reading.txHash}>
                            {shortHash(reading.txHash)}
                          </ExplorerLink>
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {detail.readings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="incidents-empty">
                      Chưa có reading nào trên chain.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <Modal
        open={!!recallTarget}
        onClose={closeRecall}
        title={`Thu hồi ${recallTarget?.batchCode ?? ''}`}
        className="roles-modal recall-modal"
        footer={
          <div className="recall-foot">
            <div className="recall-foot-actions">
              <Button variant="secondary" onClick={closeRecall}>
                Hủy
              </Button>
              <Button variant="danger" onClick={startRecall}>
                <BoltIcon />
                Xem lại &amp; ký recallBatch
              </Button>
            </div>
            {recallError && (
              <span className="recall-error" role="alert">
                <InfoIcon />
                {recallError}
              </span>
            )}
          </div>
        }
      >
        <div className="recall-pills">
          {recallTarget && (
            <span className={`batch-status ${recallTarget.lifecycle.toLowerCase()}`}>
              {LIFECYCLE_PILL[recallTarget.lifecycle]}
            </span>
          )}
          <strong className="recall-incident-id">
            tokenId {recallTarget?.tokenId ?? ''} · {recallTarget?.farmId} /{' '}
            {recallTarget?.harvestGroupId}
          </strong>
        </div>

        <div className="recall-form">
          <label htmlFor="recall-incident">Sự cố tham chiếu</label>
          <select
            id="recall-incident"
            value={incidentRef ?? ''}
            onChange={(event) => {
              setIncidentRef(Number(event.target.value))
              setRecallError('')
            }}
          >
            {incidents.map((row: AdminIncidentRow) => (
              <option key={row.incidentId} value={row.incidentId}>
                #{row.incidentId} · {row.batchCode}
              </option>
            ))}
          </select>
          <span className="recall-hint">
            Sự cố phải tồn tại trên chain; có thể chọn sự cố của lô khác.
          </span>

          <label htmlFor="recall-reason">Lý do thu hồi</label>
          <textarea
            id="recall-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setRecallError('')
            }}
            placeholder="Ví dụ: Cùng farmId và harvestGroupId với lô có sự cố, thu hồi để điều tra thêm."
            rows={4}
          />
          <span className="recall-hint">
            Bắt buộc, ít nhất {MIN_REASON_LENGTH} ký tự. Lý do được lưu trong manifest JSON trên
            IPFS; CID và SHA-256 của manifest được ghi lên chain.
          </span>

          <label htmlFor="recall-pdf">Tệp PDF lý do thu hồi</label>
          <input
            id="recall-pdf"
            type="file"
            accept="application/pdf"
            onChange={(event) => void pickPdf(event.target.files?.[0] ?? null)}
          />
          {fileError && (
            <span className="recall-error" role="alert">
              <InfoIcon />
              {fileError}
            </span>
          )}
          {pdfFile && (
            <div className="recall-file">
              <span>
                <strong>{pdfFile.name}</strong> · {formatBytes(pdfFile.size)}
              </span>
              <span className="incident-hash-chip">
                SHA-256 <span className="mono break">{pdfSha}</span>
                <CopyButton text={pdfSha} message="Đã sao chép SHA-256" />
              </span>
            </div>
          )}
          <span className="recall-hint">
            Bắt buộc. PDF được tải lên IPFS và gắn vào lô sau khi giao dịch thu hồi thành công.
          </span>
        </div>

        <div className="recall-scope">
          <span className="recall-scope-icon">
            <AlertIcon size={20} />
          </span>
          <div>
            <strong>Phạm vi: chỉ lô này</strong>
            <p>
              Các lô khác (kể cả ứng viên cùng nhóm) không bị ảnh hưởng. Trạng thái Sold và chủ sở
              hữu NFT được giữ nguyên.
            </p>
          </div>
        </div>
      </Modal>

      <TxProgressModal
        open={!!operation || !!bindPending}
        onClose={closeProgress}
        title={`Thu hồi ${operation?.batch.batchCode ?? bindPending?.batchCode ?? ''}`}
        method="recallBatch(tokenId, incidentId, reasonCID, reasonHash)"
        summary={
          operation
            ? [
                {
                  label: 'Lô',
                  value: `${operation.batch.batchCode} (#${operation.batch.tokenId})`,
                },
                { label: 'incidentId', value: `#${operation.incidentId}` },
                { label: 'Lý do', value: operation.reason },
                {
                  label: 'PDF',
                  value: `${operation.file.name} · ${formatBytes(operation.file.size)}`,
                },
                {
                  label: 'SHA-256 PDF',
                  value: <span className="mono">{shortHash(operation.sha256)}</span>,
                },
              ]
            : bindPending
              ? [
                  { label: 'Lô', value: bindPending.batchCode },
                  {
                    label: 'documentId',
                    value: <span className="mono">{bindPending.documentId}</span>,
                  },
                ]
              : []
        }
        steps={TX_STEPS}
        flow={flow.state}
        successNote={
          operation
            ? `Đã thu hồi ${operation.batch.batchCode} trên blockchain và gắn tệp lý do. Trạng thái lô đã đọc lại từ hợp đồng.`
            : bindPending
              ? `Đã gắn lại tệp lý do cho ${bindPending.batchCode}.`
              : undefined
        }
        onRetry={
          stage === 'bind' && bindPending
            ? () => void retryBind()
            : operation
              ? () => void runRecall(operation)
              : undefined
        }
      />
    </div>
  )
}
