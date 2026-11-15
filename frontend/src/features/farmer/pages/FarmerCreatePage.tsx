import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { TxProgressModal, type TxStepDef } from '../../../components/TxProgressModal'
import { Button, Card, Input, PageHeader } from '../../../components/ui'
import { config } from '../../../config/env'
import { BATCH_WEIGHT_KG } from '../../../domain/types'
import { useStepFlow } from '../../../hooks/useStepFlow'
import { sha256Hex, toBytes32, utf8Bytes } from '../../../lib/hash'
import {
  bindDocument,
  describeApiError,
  uploadDocument,
  type DocType,
  type DocumentOut,
} from '../../../services/documentsApi'
import { HttpError } from '../../../services/http'
import { findEvent, sendTransaction, TxError } from '../../../services/tx'
import { ExplorerLink } from '../../public/components/ExplorerLink'
import { TraceQRCode } from '../../public/components/TraceQRCode'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import { batchCodeTaken, readFarmId } from '../services/farmerChain'
import '../../public/styles/trace-detail.css'
import '../styles/farmer-create.css'

const STEPS = ['Dữ liệu lô', 'Tệp công khai', 'Metadata & hóa đơn', 'Xem lại & ký', 'Biên nhận']
const TX_STEPS: TxStepDef[] = [
  { label: 'Kiểm tra điều kiện', description: 'Đối chiếu vai trò, farmId, mạng và bộ hồ sơ đã tải lên.' },
  { label: 'Chờ ký ví', description: 'Xác nhận createBatch trong cửa sổ MetaMask.' },
  { label: 'Phát giao dịch', description: 'Giao dịch được gửi lên mạng.' },
  { label: 'Chờ biên nhận', description: 'Chờ mạng xác nhận giao dịch và mint NFT.' },
  { label: 'Gắn hồ sơ', description: 'Backend đối chiếu biên nhận rồi gắn hồ sơ vào lô.' },
]
const emptyForm = {
  batchCode: '',
  farmLocation: '',
  harvestGroupId: '',
  harvestDate: '',
  expiryDate: '',
  cultivar: '',
  fertilizer: '',
  minTemperature: '',
  maxTemperature: '',
}
type FormKey = keyof typeof emptyForm
type FormErrors = Partial<Record<FormKey, string>>
type FileKind = 'certificate' | 'image' | 'invoice'
type SelectedFile = { file: File; sha256?: string; error?: string }
type Uploads = Partial<Record<FileKind | 'metadata', DocumentOut>>
type Receipt = { tokenId: string; txHash: string; tokenUri: string }

function todayLocal() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return value ? value.split('-').reverse().join('/') : 'Chưa có'
}

/** Giây Unix của đầu ngày thu hoạch và cuối ngày hạn sử dụng theo giờ địa phương. */
const startOfDay = (date: string) => Math.floor(new Date(`${date}T00:00:00`).getTime() / 1000)
const endOfDay = (date: string) => Math.floor(new Date(`${date}T23:59:59`).getTime() / 1000)

function matchesFileSignature(file: File, bytes: ArrayBuffer, kind: FileKind) {
  const value = new Uint8Array(bytes)
  if (kind !== 'image') {
    return (
      file.type === 'application/pdf' &&
      /\.pdf$/i.test(file.name) &&
      value[0] === 0x25 &&
      value[1] === 0x50 &&
      value[2] === 0x44 &&
      value[3] === 0x46 &&
      value[4] === 0x2d
    )
  }
  if (file.type === 'image/jpeg')
    return /\.(jpe?g)$/i.test(file.name) && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff
  if (file.type === 'image/png')
    return (
      /\.png$/i.test(file.name) &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => value[index] === byte)
    )
  return false
}

function validateForm(form: typeof emptyForm): FormErrors {
  const errors: FormErrors = {}
  const code = form.batchCode.trim().toUpperCase()
  if (!code) errors.batchCode = 'Nhập mã lô.'
  else if (!/^[A-Z0-9-]+$/.test(code)) errors.batchCode = 'Mã lô chỉ gồm chữ in hoa, số và dấu gạch nối.'
  if (!form.farmLocation.trim()) errors.farmLocation = 'Nhập vị trí nông trại.'
  if (!form.harvestGroupId.trim()) errors.harvestGroupId = 'Nhập nhóm thu hoạch.'
  if (!form.harvestDate) errors.harvestDate = 'Chọn ngày thu hoạch.'
  else if (form.harvestDate > todayLocal()) errors.harvestDate = 'Ngày thu hoạch không được ở tương lai.'
  if (!form.expiryDate) errors.expiryDate = 'Chọn hạn sử dụng.'
  else if (form.expiryDate <= todayLocal()) errors.expiryDate = 'Hạn sử dụng phải sau hôm nay.'
  if (form.harvestDate && form.expiryDate && form.harvestDate >= form.expiryDate)
    errors.expiryDate = 'Hạn sử dụng phải sau ngày thu hoạch.'
  if (!form.cultivar.trim()) errors.cultivar = 'Nhập giống dừa.'
  if (!form.fertilizer.trim()) errors.fertilizer = 'Nhập thông tin phân bón.'
  if (form.minTemperature === '' || !Number.isFinite(Number(form.minTemperature)))
    errors.minTemperature = 'Nhập ngưỡng nhiệt độ tối thiểu.'
  if (form.maxTemperature === '' || !Number.isFinite(Number(form.maxTemperature)))
    errors.maxTemperature = 'Nhập ngưỡng nhiệt độ tối đa.'
  if (!errors.minTemperature && !errors.maxTemperature && Number(form.minTemperature) > Number(form.maxTemperature))
    errors.maxTemperature = 'Ngưỡng tối đa phải lớn hơn hoặc bằng ngưỡng tối thiểu.'
  return errors
}

function LockedField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="farmer-create-locked">
        <FarmerOverviewIcon name="lock" />
        <input id={id} value={value} disabled />
      </div>
    </div>
  )
}

function FilePicker({
  id,
  label,
  accept,
  selected,
  onChange,
  hint,
  error,
  image = false,
  publicFile = false,
  cid,
}: {
  id: string
  label: string
  accept: string
  selected: SelectedFile | null
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  hint: string
  error?: string
  image?: boolean
  publicFile?: boolean
  cid?: string
}) {
  const [previewImage, setPreviewImage] = useState<{ file: File; url: string } | null>(null)
  useEffect(() => {
    if (!image || !selected?.sha256) return
    const url = URL.createObjectURL(selected.file)
    setPreviewImage({ file: selected.file, url })
    return () => URL.revokeObjectURL(url)
  }, [image, selected?.file, selected?.sha256])
  return (
    <div className="farmer-create-file">
      <label htmlFor={id}>{label}</label>
      <p>{hint}</p>
      <input
        className={publicFile ? 'farmer-create-file-input' : undefined}
        id={id}
        type="file"
        accept={accept}
        onChange={onChange}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
      />
      {publicFile && (
        <label className="farmer-create-file-button" htmlFor={id}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" />
          </svg>
          Chọn tệp
        </label>
      )}
      {selected && (
        <div className="farmer-create-file-meta">
          <strong className={publicFile && selected.sha256 ? 'farmer-create-file-valid' : ''}>
            {publicFile && selected.sha256 && <FarmerOverviewIcon name="check" />}
            <span>{selected.file.name}</span>
          </strong>
          <span>
            {(selected.file.size / 1024).toFixed(1)} KB · {selected.file.type}
          </span>
          {selected.sha256 ? (
            <small className="mono">SHA-256 từ byte tệp: {selected.sha256}</small>
          ) : (
            !selected.error && <small>Đang tính SHA-256 từ byte tệp…</small>
          )}
          {selected.error && <span className="field-error">{selected.error}</span>}
        </div>
      )}
      {image && selected && previewImage && previewImage.file === selected.file && selected.sha256 && (
        <img className="farmer-create-image-preview" src={previewImage.url} alt={`Xem trước ảnh gốc ${selected.file.name}`} />
      )}
      {error && (
        <span className="field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
      {publicFile && <span className="farmer-create-cid">CID: {cid ?? 'Chưa tải lên IPFS'}</span>}
    </div>
  )
}

type FarmIdState = { status: 'loading' } | { status: 'ready'; value: string } | { status: 'none' } | { status: 'error' }

export function FarmerCreatePage() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [files, setFiles] = useState<Record<FileKind, SelectedFile | null>>({ certificate: null, image: null, invoice: null })
  const [fileError, setFileError] = useState('')
  const [publicFileErrors, setPublicFileErrors] = useState<Record<'certificate' | 'image', string>>({ certificate: '', image: '' })
  const fileSelectionVersion = useRef<Record<FileKind, number>>({ certificate: 0, image: 0, invoice: 0 })
  const [farmIdState, setFarmIdState] = useState<FarmIdState>({ status: 'loading' })
  const [uploads, setUploads] = useState<Uploads>({})
  const [metadataJson, setMetadataJson] = useState('')
  const [busy, setBusy] = useState('')
  const [stepError, setStepError] = useState('')
  const [progressOpen, setProgressOpen] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const pendingBind = useRef<{ tokenId: string; txHash: string } | null>(null)
  const flow = useStepFlow()

  const address = session?.wallet.address
  const realWallet = session?.source === 'chain'
  const farmId = farmIdState.status === 'ready' ? farmIdState.value : ''
  const roleValid = !!session?.wallet.roles.includes('farmer')
  const networkValid = session?.wallet.chainId === config.chainId
  const code = form.batchCode.trim().toUpperCase()
  const docsReady = !!uploads.certificate && !!uploads.image && !!uploads.metadata
  const canSign = realWallet && roleValid && networkValid && !!farmId && docsReady && flow.state.phase !== 'running'

  useEffect(() => {
    if (!address || !realWallet) return
    let active = true
    readFarmId(address).then(
      (value) => active && setFarmIdState(value ? { status: 'ready', value } : { status: 'none' }),
      () => active && setFarmIdState({ status: 'error' }),
    )
    return () => {
      active = false
    }
  }, [address, realWallet])

  function update(key: FormKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    // metadata được dựng từ biểu mẫu: đổi dữ liệu thì phải tạo và tải lại metadata
    setUploads((current) => ({ ...current, metadata: undefined }))
    setMetadataJson('')
  }

  async function chooseFile(kind: FileKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const version = ++fileSelectionVersion.current[kind]
    event.target.value = ''
    const invalidMessage =
      kind === 'image' ? 'Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG hợp lệ.' : 'Chỉ chấp nhận tệp PDF hợp lệ.'
    if (kind === 'invoice') setFileError('')
    else setPublicFileErrors((current) => ({ ...current, [kind]: '' }))
    setUploads((current) => ({ ...current, [kind]: undefined, ...(kind !== 'invoice' ? { metadata: undefined } : {}) }))
    setMetadataJson('')
    setFiles((current) => ({ ...current, [kind]: null }))
    try {
      const bytes = await file.arrayBuffer()
      if (fileSelectionVersion.current[kind] !== version) return
      if (!matchesFileSignature(file, bytes, kind)) {
        if (kind === 'invoice') setFileError(invalidMessage)
        else setPublicFileErrors((current) => ({ ...current, [kind]: invalidMessage }))
        return
      }
      setFiles((current) => ({ ...current, [kind]: { file } }))
      const hash = await sha256Hex(bytes)
      if (fileSelectionVersion.current[kind] !== version) return
      setFiles((current) => (current[kind]?.file === file ? { ...current, [kind]: { file, sha256: hash } } : current))
    } catch {
      if (fileSelectionVersion.current[kind] !== version) return
      setFiles((current) => ({ ...current, [kind]: { file, error: 'Không thể đọc hoặc tính SHA-256 cho tệp này.' } }))
    }
  }

  /** Tải một tệp lên backend và đối chiếu hash backend tính được với hash tự tính trong trình duyệt. */
  async function upload(blob: Blob, name: string, type: DocType, localSha: string): Promise<DocumentOut> {
    const doc = await uploadDocument(blob, name, type)
    if (doc.sha256.toLowerCase() !== localSha.toLowerCase())
      throw new Error(`Hash của ${name} do máy chủ tính khác với hash trong trình duyệt. Hãy thử tải lại.`)
    return doc
  }

  function buildMetadata(certificate: DocumentOut, image: DocumentOut): string {
    return JSON.stringify(
      {
        name: code,
        description: `Lô dừa xiêm xanh nguyên trái ${BATCH_WEIGHT_KG} kg`,
        image: `ipfs://${image.cid}`,
        batchCode: code,
        farmId,
        harvestGroupId: form.harvestGroupId.trim(),
        quantityKg: BATCH_WEIGHT_KG,
        certificateURI: `ipfs://${certificate.cid}`,
        certificateSHA256: certificate.sha256,
        imageSHA256: image.sha256,
        schemaVersion: 1,
        cultivar: form.cultivar.trim(),
        fertilizer: form.fertilizer.trim(),
        farmLocation: form.farmLocation.trim(),
        tempMin: Number(form.minTemperature),
        tempMax: Number(form.maxTemperature),
      },
      null,
      2,
    )
  }

  /** Bước 2 → 3: tải chứng chỉ và ảnh, rồi dựng và tải metadata.json có CID thật. */
  async function prepareDocuments(): Promise<boolean> {
    const certificate = files.certificate
    const image = files.image
    if (!certificate?.sha256 || !image?.sha256) return false
    setStepError('')
    try {
      let cert = uploads.certificate
      let img = uploads.image
      if (!cert) {
        setBusy('Đang tải chứng chỉ lên IPFS…')
        cert = await upload(certificate.file, certificate.file.name, 'certificate', certificate.sha256)
      }
      if (!img) {
        setBusy('Đang tải ảnh lô lên IPFS…')
        img = await upload(image.file, image.file.name, 'image', image.sha256)
      }
      setBusy('Đang tạo và tải metadata.json lên IPFS…')
      const text = buildMetadata(cert, img)
      const bytes = utf8Bytes(text)
      const metaSha = await sha256Hex(bytes)
      const meta = await upload(new Blob([text], { type: 'application/json' }), 'metadata.json', 'metadata', metaSha)
      setMetadataJson(text)
      setUploads((current) => ({ ...current, certificate: cert, image: img, metadata: meta }))
      return true
    } catch (error) {
      setStepError(error instanceof HttpError ? describeApiError(error) : error instanceof Error ? error.message : 'Tải hồ sơ thất bại.')
      return false
    } finally {
      setBusy('')
    }
  }

  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (step === 0) {
      const nextErrors = validateForm(form)
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length || !farmId) return
      setBusy('Đang kiểm tra mã lô trên blockchain…')
      try {
        if (await batchCodeTaken(code)) {
          setErrors({ batchCode: 'Mã lô đã tồn tại trên blockchain.' })
          return
        }
      } catch {
        setStepError('Không kiểm tra được mã lô vì không đọc được blockchain. Hãy thử lại.')
        return
      } finally {
        setBusy('')
      }
      setStepError('')
    }
    if (step === 1) {
      if (!files.certificate?.sha256 || !files.image?.sha256) {
        setPublicFileErrors({
          certificate: files.certificate?.sha256 ? '' : 'Cần chọn PDF chứng chỉ.',
          image: files.image?.sha256 ? '' : 'Cần chọn ảnh gốc của lô.',
        })
        return
      }
      if (!(await prepareDocuments())) return
    }
    if (step === 2 && files.invoice?.sha256 && !uploads.invoice) {
      setBusy('Đang mã hóa và tải hóa đơn riêng…')
      setStepError('')
      try {
        const doc = await upload(files.invoice.file, files.invoice.file.name, 'invoice', files.invoice.sha256)
        setUploads((current) => ({ ...current, invoice: doc }))
      } catch (error) {
        setStepError(error instanceof HttpError ? describeApiError(error) : error instanceof Error ? error.message : 'Tải hóa đơn thất bại.')
        return
      } finally {
        setBusy('')
      }
    }
    if (step < 3) setStep((current) => current + 1)
  }

  /** Gắn các hồ sơ vào lô: tài liệu của createBatch cần txHash, hóa đơn chỉ cần tokenId. */
  async function bindAll(tokenId: string, txHash: string) {
    const jobs: [DocumentOut, string | undefined][] = [
      [uploads.metadata!, txHash],
      [uploads.certificate!, txHash],
      [uploads.image!, txHash],
    ]
    if (uploads.invoice) jobs.push([uploads.invoice, undefined])
    for (const [doc, hash] of jobs) {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await bindDocument(doc.id, tokenId, hash)
          break
        } catch (error) {
          const retryable = error instanceof HttpError && ['TX_RECEIPT_INVALID', 'CHAIN_UNAVAILABLE'].includes(error.code)
          if (!retryable || attempt >= 5) throw error
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }
    }
  }

  async function finishAfterMint(tokenId: string, txHash: string) {
    flow.goTo(4)
    try {
      await bindAll(tokenId, txHash)
    } catch (error) {
      pendingBind.current = { tokenId, txHash }
      flow.fail(
        `Lô đã được tạo trên blockchain (token #${tokenId}) nhưng chưa gắn được hồ sơ: ${describeApiError(error)} Bấm “Thử lại” để gắn hồ sơ, không cần ký lại.`,
      )
      return
    }
    pendingBind.current = null
    setReceipt({ tokenId, txHash, tokenUri: `ipfs://${uploads.metadata!.cid}` })
    flow.succeed()
  }

  async function createOnChain() {
    if (pendingBind.current) {
      flow.start()
      const { tokenId, txHash } = pendingBind.current
      flow.setTxHash(txHash)
      await finishAfterMint(tokenId, txHash)
      return
    }
    if (!address || !uploads.metadata || !uploads.certificate || !uploads.image) return
    setProgressOpen(true)
    flow.start()
    try {
      if (!realWallet || !roleValid) throw new TxError('precondition', 'Cần đăng nhập bằng ví có vai trò Farmer.')
      if (!networkValid) throw new TxError('precondition', 'Ví đang ở sai mạng.')
      if (!farmId) throw new TxError('precondition', 'Ví chưa được gán farmId.')
      if (await batchCodeTaken(code)) throw new TxError('precondition', 'Mã lô đã tồn tại trên blockchain.')
      const info = {
        batchCode: code,
        harvestGroupId: form.harvestGroupId.trim(),
        farmLocation: form.farmLocation.trim(),
        quantityKg: BATCH_WEIGHT_KG,
        harvestDate: startOfDay(form.harvestDate),
        expiryDate: endOfDay(form.expiryDate),
      }
      const { hash, receipt: txReceipt } = await sendTransaction(
        address,
        (contract) =>
          contract.createBatch(
            info,
            uploads.metadata!.cid,
            toBytes32(uploads.metadata!.sha256),
            toBytes32(uploads.certificate!.sha256),
            toBytes32(uploads.image!.sha256),
          ),
        {
          onSigning: () => flow.goTo(1),
          onBroadcast: (txHash) => {
            flow.setTxHash(txHash)
            flow.goTo(3)
          },
        },
      )
      const created = findEvent(txReceipt, 'BatchCreated')
      if (!created) throw new TxError('unknown', 'Không thấy sự kiện BatchCreated trong biên nhận.')
      await finishAfterMint(String(created.tokenId), hash)
    } catch (error) {
      if (error instanceof TxError) flow.fail(error.message, error.kind === 'rejected')
      else if (error instanceof Error && !(error instanceof HttpError)) flow.fail(error.message)
      else flow.fail(describeApiError(error))
    }
  }

  function closeProgress() {
    setProgressOpen(false)
    if (flow.state.phase === 'success') setStep(4)
    flow.reset()
  }

  const trustNotice = !realWallet
    ? 'Cần đăng nhập bằng ví thật (MetaMask) để tạo lô. Phiên xem giao diện không ghi được lên blockchain.'
    : !roleValid
      ? 'Ví đang đăng nhập không có vai trò Farmer.'
      : farmIdState.status === 'none'
        ? 'Ví này chưa được Admin gán farmId, chưa thể tạo lô. Hãy liên hệ Admin.'
        : farmIdState.status === 'error'
          ? 'Không đọc được farmId từ blockchain. Hãy kiểm tra mạng rồi tải lại trang.'
          : ''

  return (
    <div className="farmer-create-page">
      <PageHeader title="Tạo lô NFT mới" description="Tạo lô dừa 1.000 kg và chuẩn bị hồ sơ để mint 1 NFT ERC-721." />

      <ol className="farmer-create-stepper" aria-label="Các bước tạo lô">
        {STEPS.map((label, index) => (
          <li key={label} className={index < step ? 'complete' : index === step ? 'active' : ''} aria-current={index === step ? 'step' : undefined}>
            <span className="farmer-create-step-number">{index < step ? <FarmerOverviewIcon name="check" /> : index + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <Card className="farmer-create-card">
        <form onSubmit={(event) => void next(event)} noValidate>
          {step === 0 && (
            <>
              <div className="farmer-create-heading">
                <h2>Thông tin lô</h2>
              </div>
              {trustNotice && (
                <div className="farmer-create-notice" role="alert">
                  {trustNotice}
                </div>
              )}
              <div className="farmer-create-grid">
                <Input label="Mã lô *" placeholder="COCONUT-007" value={form.batchCode} onChange={(event) => update('batchCode', event.target.value)} error={errors.batchCode} />
                <LockedField
                  id="farmer-create-farm-id"
                  label="Farm ID"
                  value={farmIdState.status === 'loading' ? 'Đang đọc từ hợp đồng…' : farmId || 'Chưa được gán'}
                />
                <Input label="Vị trí nông trại *" value={form.farmLocation} onChange={(event) => update('farmLocation', event.target.value)} error={errors.farmLocation} />
                <Input label="Nhóm thu hoạch *" placeholder="HG-A03" value={form.harvestGroupId} onChange={(event) => update('harvestGroupId', event.target.value)} error={errors.harvestGroupId} />
                <Input label="Ngày thu hoạch *" type="date" max={todayLocal()} value={form.harvestDate} onChange={(event) => update('harvestDate', event.target.value)} error={errors.harvestDate} />
                <Input label="Hạn sử dụng *" type="date" min={todayLocal()} value={form.expiryDate} onChange={(event) => update('expiryDate', event.target.value)} error={errors.expiryDate} />
                <Input label="Giống dừa *" value={form.cultivar} onChange={(event) => update('cultivar', event.target.value)} error={errors.cultivar} />
                <Input label="Phân bón *" value={form.fertilizer} onChange={(event) => update('fertilizer', event.target.value)} error={errors.fertilizer} />
                <Input label="Nhiệt độ tối thiểu (°C) *" type="number" step="0.1" value={form.minTemperature} onChange={(event) => update('minTemperature', event.target.value)} error={errors.minTemperature} />
                <Input label="Nhiệt độ tối đa (°C) *" type="number" step="0.1" value={form.maxTemperature} onChange={(event) => update('maxTemperature', event.target.value)} error={errors.maxTemperature} />
                <LockedField id="farmer-create-weight" label="Khối lượng" value="1.000 kg · 1 NFT" />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="farmer-create-heading">
                <h2>Hồ sơ công khai</h2>
                <p>Chọn PDF chứng chỉ gốc và ảnh gốc của lô. Bấm Tiếp tục để tải lên IPFS.</p>
              </div>
              <div className="farmer-create-upload-grid">
                <FilePicker id="farmer-create-certificate" label="Chứng chỉ PDF (công khai)" accept="application/pdf,.pdf" selected={files.certificate} onChange={(event) => void chooseFile('certificate', event)} hint="PDF gốc, tối đa 10 MB." error={publicFileErrors.certificate} publicFile cid={uploads.certificate?.cid} />
                <FilePicker id="farmer-create-image" label="Ảnh gốc của lô (công khai)" accept="image/jpeg,image/png" selected={files.image} onChange={(event) => void chooseFile('image', event)} hint="JPG, JPEG hoặc PNG gốc, tối đa 10 MB." error={publicFileErrors.image} image publicFile cid={uploads.image?.cid} />
              </div>
              <p className="farmer-create-footnote">SHA-256 được tính từ byte tệp đã chọn và được máy chủ tính lại để đối chiếu sau khi tải lên.</p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="farmer-create-heading">
                <h2>Metadata và hồ sơ riêng</h2>
                <p>Metadata công khai đã được tạo từ biểu mẫu và hai tệp ở bước trước. Hóa đơn riêng được tách biệt.</p>
              </div>
              <div className="farmer-create-document-grid">
                {(
                  [
                    ['certificate.pdf', uploads.certificate, 'application/pdf'],
                    ['Ảnh gốc của lô', uploads.image, files.image?.file.type ?? 'image'],
                    ['metadata.json', uploads.metadata, 'application/json'],
                  ] as const
                ).map(([name, doc, mediaType]) => (
                  <div className="farmer-create-document" key={name}>
                    <strong>{name}</strong>
                    <span className="mono">CID: {doc?.cid ?? 'Chưa tải lên'}</span>
                    <span>{mediaType}</span>
                    <small className="mono">SHA-256: {doc?.sha256 ?? '—'}</small>
                  </div>
                ))}
              </div>
              <details className="farmer-create-metadata">
                <summary>Xem nội dung metadata.json</summary>
                <pre>{metadataJson}</pre>
              </details>
              <FilePicker id="farmer-create-invoice" label="Hóa đơn bán buôn riêng (tùy chọn)" accept="application/pdf,.pdf" selected={files.invoice} onChange={(event) => void chooseFile('invoice', event)} hint="Không đưa vào metadata hay IPFS công khai; được mã hóa AES-256-GCM trước khi lưu." />
              {fileError && (
                <p className="field-error" role="alert">
                  {fileError}
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <dl className="farmer-create-review">
                <div><dt>Mã lô</dt><dd className="mono">{code}</dd></div>
                <div><dt>Trang trại / Nhóm</dt><dd>{farmId || 'Chưa được gán'} / {form.harvestGroupId}</dd></div>
                <div><dt>Thu hoạch → hết hạn</dt><dd>{formatDate(form.harvestDate)} → {formatDate(form.expiryDate)}</dd></div>
                <div><dt>Giống</dt><dd>{form.cultivar}</dd></div>
                <div><dt>Khối lượng</dt><dd>1.000 kg</dd></div>
                <div><dt>Hóa đơn riêng</dt><dd>{uploads.invoice ? `${files.invoice?.file.name} (gắn vào lô sau khi mint)` : 'Không có'}</dd></div>
              </dl>
              <ul className="farmer-create-checklist" aria-label="Điều kiện trước khi mint">
                {[
                  { label: 'Vai trò Farmer', detail: roleValid ? 'Đọc từ hợp đồng khi đăng nhập.' : 'Ví không có vai trò Farmer.', status: roleValid ? 'ready' : 'missing' },
                  { label: 'farmId được gán', detail: farmId ? `${farmId} · đọc từ hợp đồng` : 'Chưa có farmId từ Admin.', status: farmId ? 'ready' : 'missing' },
                  { label: 'Đúng mạng', detail: networkValid ? `chainId ${config.chainId} khớp cấu hình.` : 'Ví đang ở sai mạng.', status: networkValid ? 'ready' : 'missing' },
                  { label: 'Khối lượng 1.000 kg', detail: 'Cố định theo quy tắc một lô = một NFT.', status: 'ready' },
                  { label: 'Ba hồ sơ công khai', detail: docsReady ? 'Đã tải lên IPFS, có CID và SHA-256 khớp với máy chủ.' : 'Chưa tải đủ chứng chỉ, ảnh và metadata.', status: docsReady ? 'ready' : 'missing' },
                  { label: 'Mã lô chưa dùng', detail: 'Đã kiểm tra với blockchain ở bước đầu.', status: 'ready' },
                ].map((check) => (
                  <li key={check.label} className={check.status}>
                    <span className="farmer-create-check-icon">{check.status === 'ready' ? <FarmerOverviewIcon name="check" /> : '!'}</span>
                    <span><strong>{check.label}</strong><small>{check.detail}</small></span>
                  </li>
                ))}
              </ul>
              <div className="farmer-create-notice farmer-create-sign-notice" role="status">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
                <span>Bấm “Ký và gửi createBatch”, MetaMask sẽ hỏi xác nhận. Giao dịch mint NFT và ghi các hash hồ sơ lên blockchain; sau khi có biên nhận, hồ sơ được gắn vào lô.</span>
              </div>
            </>
          )}

          {step === 4 && receipt && (
            <>
              <div className="farmer-create-receipt-banner" role="status">
                <FarmerOverviewIcon name="check" />
                <div>
                  <strong>Đã tạo lô thành công</strong>
                  <p>Lô {code} đã được mint thành NFT #{receipt.tokenId} và thuộc về ví của bạn.</p>
                </div>
              </div>
              <dl className="farmer-create-receipt-details">
                <div><dt>Token ID</dt><dd className="mono">#{receipt.tokenId}</dd></div>
                <div><dt>tokenURI</dt><dd className="mono">{receipt.tokenUri}</dd></div>
                <div><dt>txHash</dt><dd><ExplorerLink kind="tx" value={receipt.txHash} /></dd></div>
                <div><dt>Hóa đơn riêng</dt><dd>{uploads.invoice ? `${files.invoice?.file.name} · đã gắn vào lô` : 'Không có'}</dd></div>
              </dl>
              <TraceQRCode code={code} path={`/trace/${config.chainId}/${config.contractAddress}/${receipt.tokenId}`} />
              <div className="farmer-create-result-actions">
                <Button type="button" onClick={() => navigate(`/farmer/batches/${encodeURIComponent(code)}`)}>Xem chi tiết lô</Button>
                <Link className="button secondary" to="/farmer/transfers">Yêu cầu chuyển cho Logistics</Link>
              </div>
            </>
          )}

          {(busy || stepError) && step < 4 && (
            <p className={stepError ? 'field-error' : 'farmer-create-footnote'} role={stepError ? 'alert' : 'status'}>
              {busy || stepError}
            </p>
          )}

          {step < 4 && (
            <div className={`farmer-create-actions ${step === 0 ? 'farmer-create-actions-single' : ''}`}>
              {step > 0 && (
                <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={!!busy || flow.state.phase === 'running'}>
                  Quay lại
                </Button>
              )}
              {step < 3 && (
                <Button type="submit" disabled={!!busy || (step === 0 && (!realWallet || !roleValid || !farmId))}>
                  {busy ? 'Đang xử lý…' : <>Tiếp tục <FarmerOverviewIcon name="arrow" /></>}
                </Button>
              )}
              {step === 3 && (
                <Button type="button" onClick={() => void createOnChain()} disabled={!canSign}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 10a5 5 0 11-4 4l-7 7v-3h3v-3h3l1-1M17 7h.01" /></svg> Ký và gửi createBatch
                </Button>
              )}
            </div>
          )}
        </form>
      </Card>

      <TxProgressModal
        open={progressOpen}
        onClose={closeProgress}
        title={`Tạo lô ${code} và mint NFT`}
        method="createBatch()"
        summary={[
          { label: 'batchCode', value: <span className="mono">{code}</span> },
          { label: 'farmId', value: farmId || 'Chưa có' },
          { label: 'quantityKg', value: '1.000' },
          { label: 'Hóa đơn riêng', value: uploads.invoice ? files.invoice?.file.name : 'Không có' },
        ]}
        steps={TX_STEPS}
        flow={flow.state}
        successNote={`Đã mint NFT #${receipt?.tokenId ?? ''} và gắn hồ sơ vào lô.`}
        onRetry={() => void createOnChain()}
      />
    </div>
  )
}
