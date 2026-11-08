import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '../../../app/session'
import { config } from '../../../config/env'
import { Button, Card, Input, Modal, PageHeader } from '../../../components/ui'
import { BATCH_WEIGHT_KG } from '../../../domain/types'
import { FarmerOverviewIcon } from '../components/FarmerOverviewIcon'
import type { PreviewFarmId } from '../mocks/farmerOverviewFixtures'
import { getFarmerOverviewFixture } from '../mocks/farmerOverviewFixtures'
import '../styles/farmer-create.css'

const STEPS = ['Dữ liệu lô', 'Tệp công khai', 'Metadata & hóa đơn', 'Xem lại & ký', 'Biên nhận']
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
type MintStage = 'idle' | 'validating' | 'awaitingSignature' | 'broadcast' | 'pending' | 'confirmed' | 'rejected'
const MINT_PROGRESS = [
  ['Kiểm tra điều kiện', 'Đối chiếu biểu mẫu và điều kiện bản xem trước.'],
  ['Chờ ký ví', 'Xác nhận thao tác mô phỏng; không mở MetaMask.'],
  ['Phát giao dịch', 'Mô phỏng gửi giao dịch, không có txHash Sepolia.'],
  ['Chờ biên nhận', 'Mô phỏng thời gian chờ xác nhận.'],
  ['Xác nhận', 'Hoàn tất quy trình xem trước.'],
] as const

function todayLocal() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return value ? value.split('-').reverse().join('/') : 'Chưa có'
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function matchesFileSignature(file: File, bytes: ArrayBuffer, kind: FileKind) {
  const value = new Uint8Array(bytes)
  if (kind !== 'image') {
    return file.type === 'application/pdf' && /\.pdf$/i.test(file.name) &&
      value[0] === 0x25 && value[1] === 0x50 && value[2] === 0x44 &&
      value[3] === 0x46 && value[4] === 0x2d
  }
  if (file.type === 'image/jpeg') return /\.(jpe?g)$/i.test(file.name) && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff
  if (file.type === 'image/png') return /\.png$/i.test(file.name) && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => value[index] === byte)
  if (file.type === 'image/webp') return /\.webp$/i.test(file.name) && [0x52, 0x49, 0x46, 0x46].every((byte, index) => value[index] === byte) &&
    [0x57, 0x45, 0x42, 0x50].every((byte, index) => value[index + 8] === byte)
  return false
}

function validateForm(form: typeof emptyForm, duplicateCodes: string[]): FormErrors {
  const errors: FormErrors = {}
  const code = form.batchCode.trim().toUpperCase()
  if (!code) errors.batchCode = 'Nhập mã lô.'
  else if (!/^[A-Z0-9-]+$/.test(code)) errors.batchCode = 'Mã lô chỉ gồm chữ in hoa, số và dấu gạch nối.'
  else if (duplicateCodes.includes(code)) errors.batchCode = 'Mã lô đã có trong fixture mô phỏng. Chưa kiểm tra toàn bộ Blockchain.'
  if (!form.farmLocation.trim()) errors.farmLocation = 'Nhập vị trí nông trại.'
  if (!form.harvestGroupId.trim()) errors.harvestGroupId = 'Nhập nhóm thu hoạch.'
  if (!form.harvestDate) errors.harvestDate = 'Chọn ngày thu hoạch.'
  else if (form.harvestDate > todayLocal()) errors.harvestDate = 'Ngày thu hoạch không được ở tương lai.'
  if (!form.expiryDate) errors.expiryDate = 'Chọn hạn sử dụng.'
  else if (form.expiryDate <= todayLocal()) errors.expiryDate = 'Hạn sử dụng phải sau hôm nay.'
  if (form.harvestDate && form.expiryDate && form.harvestDate >= form.expiryDate) errors.expiryDate = 'Hạn sử dụng phải sau ngày thu hoạch.'
  if (!form.cultivar.trim()) errors.cultivar = 'Nhập giống dừa.'
  if (!form.fertilizer.trim()) errors.fertilizer = 'Nhập thông tin phân bón.'
  if (form.minTemperature === '' || !Number.isFinite(Number(form.minTemperature))) errors.minTemperature = 'Nhập ngưỡng nhiệt độ tối thiểu.'
  if (form.maxTemperature === '' || !Number.isFinite(Number(form.maxTemperature))) errors.maxTemperature = 'Nhập ngưỡng nhiệt độ tối đa.'
  if (!errors.minTemperature && !errors.maxTemperature && Number(form.minTemperature) > Number(form.maxTemperature)) errors.maxTemperature = 'Ngưỡng tối đa phải lớn hơn hoặc bằng ngưỡng tối thiểu.'
  return errors
}

function FilePicker({
  id, label, accept, selected, onChange, hint, error, image = false, publicFile = false,
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
      <input className={publicFile ? 'farmer-create-file-input' : undefined} id={id} type="file" accept={accept} onChange={onChange} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={!!error} />
      {publicFile && <label className="farmer-create-file-button" htmlFor={id}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></svg>
        Chọn tệp
      </label>}
      {selected && (
        <div className="farmer-create-file-meta">
          <strong className={publicFile && selected.sha256 ? 'farmer-create-file-valid' : ''}>{publicFile && selected.sha256 && <FarmerOverviewIcon name="check" />}<span>{selected.file.name}</span></strong>
          <span>{(selected.file.size / 1024).toFixed(1)} KB · {selected.file.type}</span>
          {selected.sha256 ? <small className="mono">SHA-256 từ byte tệp: {selected.sha256}</small> : !selected.error && <small>Đang tính SHA-256 từ byte tệp…</small>}
          {selected.error && <span className="field-error">{selected.error}</span>}
        </div>
      )}
      {image && selected && previewImage && previewImage.file === selected.file && selected.sha256 && <img className="farmer-create-image-preview" src={previewImage.url} alt={`Xem trước ảnh gốc ${selected.file.name}`} />}
      {error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
      {publicFile && <span className="farmer-create-cid">CID: Chưa có dữ liệu IPFS</span>}
    </div>
  )
}

export function FarmerCreatePage() {
  const { session } = useSession()
  const [searchParams] = useSearchParams()
  const preview = import.meta.env.DEV && session?.source === 'development-preview'
  const [previewFarmId, setPreviewFarmId] = useState<PreviewFarmId | null>(() => {
    const value = searchParams.get('previewFarm')
    return value === 'FARM-B' ? 'FARM-B' : value === 'none' ? null : 'FARM-A'
  })
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [files, setFiles] = useState<Record<FileKind, SelectedFile | null>>({ certificate: null, image: null, invoice: null })
  const [fileError, setFileError] = useState('')
  const [publicFileErrors, setPublicFileErrors] = useState<Record<'certificate' | 'image', string>>({ certificate: '', image: '' })
  const fileSelectionVersion = useRef<Record<FileKind, number>>({ certificate: 0, image: 0, invoice: 0 })
  const [metadataHash, setMetadataHash] = useState('')
  const [stage, setStage] = useState<MintStage>('idle')
  const [progressOpen, setProgressOpen] = useState(false)
  const mintRun = useRef(0)
  const stageRef = useRef(stage)
  stageRef.current = stage
  const farmId = preview ? previewFarmId : null
  const previewHost = preview ? document.getElementById('development-preview') : null
  const duplicateCodes = useMemo(() => [
    ...getFarmerOverviewFixture('FARM-A').batches,
    ...getFarmerOverviewFixture('FARM-B').batches,
  ].map((batch) => batch.code), [])

  const metadata = useMemo(() => ({
    name: form.batchCode.trim().toUpperCase(),
    description: `Lô dừa ${BATCH_WEIGHT_KG} kg · dữ liệu bản nháp`,
    image: '',
    batchCode: form.batchCode.trim().toUpperCase(),
    farmId: farmId ?? '',
    harvestGroupId: form.harvestGroupId.trim(),
    quantityKg: BATCH_WEIGHT_KG,
    certificateURI: '',
    certificateSHA256: files.certificate?.sha256 ?? '',
    imageSHA256: files.image?.sha256 ?? '',
    schemaVersion: '1.0',
    cultivar: form.cultivar.trim(),
    fertilizer: form.fertilizer.trim(),
    farmLocation: form.farmLocation.trim(),
    minTemperature: Number(form.minTemperature),
    maxTemperature: Number(form.maxTemperature),
  }), [form, farmId, files.certificate?.sha256, files.image?.sha256])
  const metadataJson = useMemo(() => JSON.stringify(metadata, null, 2), [metadata])
  const formValid = Object.keys(validateForm(form, duplicateCodes)).length === 0
  const filesValid = !!files.certificate?.sha256 && !!files.image?.sha256 && !!metadataHash
  const roleValid = !!session?.wallet.roles.includes('farmer')
  const networkValid = session?.wallet.chainId === config.chainId
  const canSimulateMint = preview && !!farmId && roleValid && networkValid && formValid && filesValid && stage === 'idle'
  const progressIndex = stage === 'validating' ? 0 : stage === 'awaitingSignature' || stage === 'rejected' ? 1 : stage === 'broadcast' ? 2 : stage === 'pending' ? 3 : 4

  useEffect(() => {
    if (step < 2 || !files.certificate?.sha256 || !files.image?.sha256) return
    let active = true
    void sha256(new TextEncoder().encode(metadataJson).buffer).then(
      (hash) => { if (active) setMetadataHash(hash) },
      () => { if (active) setMetadataHash('') },
    )
    return () => { active = false }
  }, [step, metadataJson, files.certificate?.sha256, files.image?.sha256])

  function update(key: FormKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setMetadataHash('')
  }

  async function chooseFile(kind: FileKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const version = ++fileSelectionVersion.current[kind]
    event.target.value = ''
    const invalidMessage = kind === 'image'
      ? 'Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WebP hợp lệ.'
      : 'Chỉ chấp nhận tệp PDF hợp lệ.'
    if (kind === 'invoice') setFileError('')
    else setPublicFileErrors((current) => ({ ...current, [kind]: '' }))
    if (kind !== 'invoice') setMetadataHash('')
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
      const hash = await sha256(bytes)
      if (fileSelectionVersion.current[kind] !== version) return
      setFiles((current) => current[kind]?.file === file ? { ...current, [kind]: { file, sha256: hash } } : current)
    } catch {
      if (fileSelectionVersion.current[kind] !== version) return
      setFiles((current) => ({ ...current, [kind]: { file, error: 'Không thể đọc hoặc tính SHA-256 cho tệp này.' } }))
    }
  }

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 0) {
      const nextErrors = validateForm(form, duplicateCodes)
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length || !farmId) return
    }
    if (step === 1 && (!files.certificate?.sha256 || !files.image?.sha256)) {
      setPublicFileErrors({
        certificate: files.certificate ? '' : 'Cần tải lên PDF chứng chỉ.',
        image: files.image ? '' : 'Cần tải lên ảnh gốc của lô.',
      })
      return
    }
    if (step === 2 && !metadataHash) return
    if (step < 3) setStep((current) => current + 1)
  }

  async function simulateMint() {
    if (!canSimulateMint) return
    const run = ++mintRun.current
    setProgressOpen(true)
    setStage('validating')
    await new Promise((resolve) => window.setTimeout(resolve, 450))
    if (mintRun.current !== run) return
    setStage('awaitingSignature')
  }

  async function confirmSimulation() {
    if (stage !== 'awaitingSignature') return
    const run = mintRun.current
    setStage('broadcast')
    await new Promise((resolve) => window.setTimeout(resolve, 450))
    if (mintRun.current !== run) return
    setStage('pending')
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    if (mintRun.current !== run) return
    setStage('confirmed')
  }

  const closeProgress = useCallback(() => {
    ++mintRun.current
    setProgressOpen(false)
    if (stageRef.current === 'confirmed') setStep(4)
    else setStage('idle')
  }, [])

  return (
    <div className="farmer-create-page">
      <PageHeader title="Tạo lô NFT mới" description="Tạo lô dừa 1.000 kg và chuẩn bị hồ sơ để mint 1 NFT ERC-721." />
      {previewHost && createPortal(
        <div className="farmer-create-dev-field">
          <label htmlFor="farmer-create-preview-farm">Xem trước nông trại (mô phỏng)</label>
          <select id="farmer-create-preview-farm" value={previewFarmId ?? ''} onChange={(event) => {
            setPreviewFarmId((event.target.value || null) as PreviewFarmId | null)
            setMetadataHash('')
            setStage('idle')
            setProgressOpen(false)
            setStep(0)
          }}>
            <option value="FARM-A">Farmer A · FARM-A</option>
            <option value="FARM-B">Farmer B · FARM-B</option>
            <option value="">Chưa có farmId</option>
          </select>
          <small>Chỉ thay đổi bản xem trước, không thay đổi quyền hoặc farmId thật.</small>
        </div>,
        previewHost,
      )}

      <ol className="farmer-create-stepper" aria-label="Các bước tạo lô">
        {STEPS.map((label, index) => (
          <li key={label} className={index < step ? 'complete' : index === step ? 'active' : ''} aria-current={index === step ? 'step' : undefined}>
            <span className="farmer-create-step-number">{index < step ? <FarmerOverviewIcon name="check" /> : index + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <Card className="farmer-create-card">
        <form onSubmit={next} noValidate>
          {step === 0 && <>
            <div className="farmer-create-heading"><h2>Thông tin lô</h2><p>Điền thông tin thu hoạch cho lô 1.000 kg.</p></div>
            {!farmId && <div className="farmer-create-notice" role="alert">Chưa có farmId được gán. Bản production cần mapping từ Admin trước khi có thể mint.</div>}
            <div className="farmer-create-grid">
              <Input label="Mã lô *" placeholder="COCONUT-005" value={form.batchCode} onChange={(event) => update('batchCode', event.target.value)} error={errors.batchCode} />
              <Input label="Farm ID" value={farmId ?? 'Chưa được gán'} readOnly hint="Do Admin gán; không thể chỉnh sửa tại đây." />
              <Input label="Vị trí nông trại *" value={form.farmLocation} onChange={(event) => update('farmLocation', event.target.value)} error={errors.farmLocation} />
              <Input label="Nhóm thu hoạch *" placeholder="HG-A03" value={form.harvestGroupId} onChange={(event) => update('harvestGroupId', event.target.value)} error={errors.harvestGroupId} />
              <Input label="Ngày thu hoạch *" type="date" max={todayLocal()} value={form.harvestDate} onChange={(event) => update('harvestDate', event.target.value)} error={errors.harvestDate} />
              <Input label="Hạn sử dụng *" type="date" min={todayLocal()} value={form.expiryDate} onChange={(event) => update('expiryDate', event.target.value)} error={errors.expiryDate} />
              <Input label="Giống dừa *" value={form.cultivar} onChange={(event) => update('cultivar', event.target.value)} error={errors.cultivar} />
              <Input label="Phân bón *" value={form.fertilizer} onChange={(event) => update('fertilizer', event.target.value)} error={errors.fertilizer} />
              <Input label="Nhiệt độ tối thiểu (°C) *" type="number" step="0.1" value={form.minTemperature} onChange={(event) => update('minTemperature', event.target.value)} error={errors.minTemperature} />
              <Input label="Nhiệt độ tối đa (°C) *" type="number" step="0.1" value={form.maxTemperature} onChange={(event) => update('maxTemperature', event.target.value)} error={errors.maxTemperature} />
              <Input label="Khối lượng" value="1.000 kg · 1 NFT" readOnly />
            </div>
            <p className="farmer-create-footnote">Kiểm tra mã trùng chỉ áp dụng với fixture 001–004; chưa bảo đảm tính duy nhất trên Blockchain.</p>
          </>}

          {step === 1 && <>
            <div className="farmer-create-heading"><h2>Hồ sơ công khai</h2><p>Chọn PDF chứng chỉ gốc và ảnh gốc của lô. Tệp vẫn ở trong phiên trình duyệt này.</p></div>
            <div className="farmer-create-upload-grid">
              <FilePicker id="farmer-create-certificate" label="Chứng chỉ PDF (công khai)" accept="application/pdf,.pdf" selected={files.certificate} onChange={(event) => void chooseFile('certificate', event)} hint="PDF gốc; chưa tải lên IPFS." error={publicFileErrors.certificate} publicFile />
              <FilePicker id="farmer-create-image" label="Ảnh gốc của lô (công khai)" accept="image/jpeg,image/png,image/webp" selected={files.image} onChange={(event) => void chooseFile('image', event)} hint="JPG, JPEG, PNG hoặc WebP gốc; chưa tải lên IPFS." error={publicFileErrors.image} image publicFile />
            </div>
            <p className="farmer-create-footnote">SHA-256 được tính từ byte tệp đã chọn. CID chỉ có sau khi dịch vụ IPFS trả về kết quả thật.</p>
          </>}

          {step === 2 && <>
            <div className="farmer-create-heading"><h2>Metadata và hồ sơ riêng</h2><p>Bản nháp JSON công khai và hóa đơn riêng được giữ tách biệt.</p></div>
            <div className="farmer-create-notice">Chưa có dịch vụ IPFS. Hai URI tài liệu trong metadata đang để trống; JSON này là bản nháp, chưa sẵn sàng để mint thật.</div>
            <div className="farmer-create-document-grid">
              {[
                [files.certificate?.file.name ?? 'certificate.pdf', files.certificate?.sha256, files.certificate?.file.type],
                [files.image?.file.name ?? 'Ảnh gốc của lô', files.image?.sha256, files.image?.file.type],
                ['metadata.json', metadataHash, 'application/json'],
              ].map(([name, hash, mediaType]) => <div className="farmer-create-document" key={name}>
                <strong>{name}</strong><span>CID: Chưa có dữ liệu</span>
                <span>{mediaType}</span>
                <small className="mono">SHA-256: {hash || 'Đang tính…'}</small>
              </div>)}
            </div>
            <details className="farmer-create-metadata"><summary>Xem nội dung metadata.json</summary><pre>{metadataJson}</pre></details>
            <FilePicker id="farmer-create-invoice" label="Hóa đơn bán buôn riêng (tùy chọn)" accept="application/pdf,.pdf" selected={files.invoice} onChange={(event) => void chooseFile('invoice', event)} hint="Không đưa vào metadata hoặc IPFS công khai. Chưa mã hóa AES-GCM hay cấp quyền ACL." />
            {fileError && <p className="field-error" role="alert">{fileError}</p>}
          </>}

          {step === 3 && <>
            <dl className="farmer-create-review">
              <div><dt>Mã lô</dt><dd className="mono">{form.batchCode.trim().toUpperCase()}</dd></div>
              <div><dt>Trang trại / Nhóm</dt><dd>{farmId ?? 'Chưa được gán'} / {form.harvestGroupId}</dd></div>
              <div><dt>Thu hoạch → hết hạn</dt><dd>{formatDate(form.harvestDate)} → {formatDate(form.expiryDate)}</dd></div>
              <div><dt>Giống</dt><dd>{form.cultivar}</dd></div>
              <div><dt>Khối lượng</dt><dd>1.000 kg</dd></div>
              <div><dt>Hóa đơn riêng</dt><dd>{files.invoice ? `${files.invoice.file.name} (chưa gắn token)` : 'Không có'}</dd></div>
            </dl>
            <ul className="farmer-create-checklist" aria-label="Điều kiện trước khi mint">
              {[
                { label: 'Vai trò Farmer', detail: preview && roleValid ? 'Đạt trong bản xem trước; chưa xác minh hasRole on-chain.' : 'Chưa xác minh vai trò trên hợp đồng.', status: preview && roleValid ? 'preview' : 'missing' },
                { label: 'farmId được gán', detail: farmId ? `${farmId} · mapping mô phỏng` : 'Chưa có mapping từ Admin.', status: farmId ? 'preview' : 'missing' },
                { label: 'Mạng Sepolia 11155111', detail: networkValid ? 'Chain ID trong phiên phù hợp; chưa kiểm tra RPC.' : 'Phiên chưa ở đúng chain ID.', status: networkValid ? 'preview' : 'missing' },
                { label: 'Khối lượng 1.000 kg', detail: 'Cố định theo quy tắc một lô = một NFT.', status: 'ready' },
                { label: 'Ba hồ sơ công khai', detail: filesValid ? 'Đã tính SHA-256 từ byte tệp và bản nháp JSON; chưa có CID IPFS.' : 'Chưa đủ PDF, ảnh và metadata SHA-256.', status: filesValid ? 'partial' : 'missing' },
                { label: 'Dữ liệu lô hợp lệ', detail: formValid ? 'Đạt trong fixture hiện có; chưa kiểm tra mã trùng on-chain.' : 'Cần kiểm tra lại dữ liệu lô.', status: formValid ? 'preview' : 'missing' },
              ].map((check) => <li key={check.label} className={check.status}>
                <span className="farmer-create-check-icon">{check.status === 'ready' || check.status === 'preview' ? <FarmerOverviewIcon name="check" /> : '!'}</span>
                <span><strong>{check.label}</strong><small>{check.detail}</small></span>
              </li>)}
            </ul>
            <div className="farmer-create-notice farmer-create-sign-notice" role="status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
              <span>{preview ? 'Kiểm tra lại thông tin trước khi chạy mint mô phỏng. Không có chữ ký MetaMask hoặc giao dịch Sepolia thật.' : 'Chưa có ABI, deployment COCOMARK và dịch vụ IPFS/backend. Không thể ký hoặc mint NFT thật.'}</span>
            </div>
          </>}

          {step === 4 && stage === 'confirmed' && <>
            <div className="farmer-create-receipt-banner" role="status">
              <FarmerOverviewIcon name="check" />
              <div>
                <strong>Đã tạo lô thành công <span className="farmer-create-receipt-demo">Mô phỏng</span></strong>
                <p>Token ID: chưa có. Chủ sở hữu NFT: chưa xác lập. Vòng đời on-chain: chưa có.</p>
              </div>
            </div>
            <dl className="farmer-create-receipt-details">
              <div><dt>Token ID</dt><dd className="mono">Chưa có · chưa mint NFT</dd></div>
              <div><dt>tokenURI</dt><dd className="mono">Chưa có CID metadata</dd></div>
              <div><dt>Hóa đơn riêng</dt><dd>{files.invoice ? `${files.invoice.file.name} · chưa gắn token` : 'Không có'}</dd></div>
            </dl>
            <div className="farmer-create-receipt-qr">
              <div className="farmer-create-qr-visual">
                <div className="farmer-create-qr-placeholder" aria-label="Chưa có mã QR truy xuất">Chưa có QR</div>
                <strong className="mono">{form.batchCode.trim().toUpperCase()}</strong>
              </div>
              <div className="farmer-create-qr-content">
                <h3>Mã QR truy xuất</h3>
                <p>Chưa có URL truy xuất cho lô mô phỏng này.</p>
                <div className="farmer-create-qr-actions">
                  <Button type="button" variant="secondary" disabled title="Chưa có URL truy xuất để sao chép"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg>Sao chép liên kết</Button>
                  <Button type="button" variant="secondary" disabled title="Lô mô phỏng chưa có trang truy xuất"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 5h6v6M19 5l-9 9" /><path d="M19 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5" /></svg>Mở trang truy xuất</Button>
                  <Button type="button" variant="secondary" disabled title="Chưa có mã QR để tải"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></svg>Tải mã QR</Button>
                </div>
                <details className="farmer-create-receipt-technical">
                  <summary>Thông tin kỹ thuật <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
                  <div className="farmer-create-receipt-technical-body">
                    <dl>
                      <div><dt>URL được mã hóa trong QR (bản demo)</dt><dd className="mono">Chưa có URL demo · lô chưa được lưu vào nguồn dữ liệu truy xuất.</dd></div>
                      <div><dt>URL chuẩn khi triển khai chính thức</dt><dd className="mono">/trace/11155111/{'{contractAddress}'}/{'{tokenId}'} · chưa có hợp đồng và Token ID thật</dd></div>
                    </dl>
                    <p>QR chỉ chứa địa chỉ công khai, không chứa khóa, hóa đơn hay trạng thái. URL demo khác URL của hợp đồng triển khai. Dữ liệu demo chưa được đồng bộ sang trang truy xuất cho lô này.</p>
                    <dl className="farmer-create-receipt-token-uri">
                      <div><dt>tokenURI</dt><dd className="mono">Chưa có · metadata chưa được tải lên IPFS</dd></div>
                    </dl>
                  </div>
                </details>
              </div>
            </div>
            <div className="farmer-create-result-actions"><Button type="button" disabled title="Lô mô phỏng chưa có hồ sơ chi tiết để mở">Xem chi tiết lô</Button><Button type="button" variant="secondary" disabled title="Chưa có NFT để yêu cầu chuyển giao">Yêu cầu chuyển cho Logistics</Button></div>
          </>}

          {step < 4 && <div className={`farmer-create-actions ${step === 0 ? 'farmer-create-actions-single' : ''}`}>
            {step > 0 && <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={stage === 'pending'}>Quay lại</Button>}
            {step < 3 && <Button type="submit">Tiếp tục <FarmerOverviewIcon name="arrow" /></Button>}
            {step === 3 && <Button type="button" onClick={() => void simulateMint()} disabled={!canSimulateMint}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 10a5 5 0 11-4 4l-7 7v-3h3v-3h3l1-1M17 7h.01" /></svg> Ký và gửi createBatch{preview && <span className="farmer-create-demo-tag">Mô phỏng</span>}</Button>}
          </div>}
        </form>
      </Card>
      <Modal
        open={progressOpen}
        onClose={closeProgress}
        title={`Tạo lô ${form.batchCode.trim().toUpperCase()} và mint NFT`}
        footer={stage === 'confirmed'
          ? <Button type="button" onClick={closeProgress}>Hoàn tất</Button>
          : stage === 'awaitingSignature'
            ? <><Button type="button" variant="secondary" onClick={() => setStage('rejected')}>Từ chối</Button><Button type="button" onClick={() => void confirmSimulation()}>Xác nhận mô phỏng</Button></>
            : stage === 'rejected'
              ? <Button type="button" onClick={closeProgress}>Đóng</Button>
              : <span role="status">{stage === 'validating' ? 'Đang kiểm tra mô phỏng…' : stage === 'broadcast' ? 'Đang phát giao dịch mô phỏng…' : 'Đang chờ xác nhận mô phỏng…'}</span>}
      >
        <div className="farmer-create-tx-body">
          <p className="farmer-create-tx-mode">Tiến trình mô phỏng · không ký MetaMask hoặc gửi giao dịch Sepolia</p>
          <span className="farmer-create-tx-method mono">createBatch()</span>
          <dl className="farmer-create-tx-details">
            <div><dt>batchCode</dt><dd className="mono">{form.batchCode.trim().toUpperCase()}</dd></div>
            <div><dt>farmId</dt><dd>{farmId ?? 'Chưa có'}</dd></div>
            <div><dt>quantityKg</dt><dd>1.000</dd></div>
            <div><dt>Hóa đơn riêng</dt><dd>{files.invoice ? `${files.invoice.file.name} (chưa gắn token)` : 'Không có'}</dd></div>
          </dl>
          <ol className="farmer-create-tx-progress">
            {MINT_PROGRESS.map(([label, description], index) => {
              const complete = stage === 'confirmed' || index < progressIndex
              const active = stage !== 'confirmed' && index === progressIndex
              return <li key={label} className={complete ? 'complete' : active ? stage === 'rejected' ? 'failed' : 'active' : 'pending'}>
                <span className="farmer-create-tx-mark">{complete ? <FarmerOverviewIcon name="check" /> : active ? stage === 'rejected' ? '!' : <span className="farmer-create-tx-spinner" /> : index + 1}</span>
                <span><strong>{label}</strong><small>{description}</small></span>
              </li>
            })}
          </ol>
          {stage === 'confirmed' && <div className="farmer-create-tx-success" role="status">Đã xác nhận quy trình mô phỏng. Không có biên nhận hoặc txHash on-chain.</div>}
          {stage === 'rejected' && <div className="farmer-create-tx-rejected" role="alert">Đã từ chối trong bản mô phỏng; lô chưa được mint.</div>}
        </div>
      </Modal>
    </div>
  )
}
