import { useCallback, useEffect, useState } from 'react'
import { Button, Card, EmptyState, ErrorState, LoadingState, Select } from '../../../components/ui'
import { sha256Hex } from '../../../lib/hash'
import {
  describeApiError,
  downloadPrivateDocument,
  grantDocumentAccess,
  listPrivateDocuments,
  revokeDocumentAccess,
  type DocumentListItem,
} from '../../../services/documentsApi'
import { listRoleMembers } from '../../../services/roles'
import { TraceIcon } from '../../public/components/TraceIcon'

interface Props {
  tokenId: string
}

interface Candidate {
  address: string
  role: string
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
const formatDate = (iso: string) => new Date(iso).toLocaleString('vi-VN')
const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

type Notice = { tone: 'ok' | 'error'; text: string }

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function DocumentCard({ doc, candidates, onChanged }: { doc: DocumentListItem; candidates: Candidate[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [target, setTarget] = useState('')

  const active = doc.grants.filter((grant) => !grant.revoked_at)
  const activeWallets = new Set(active.map((grant) => grant.wallet.toLowerCase()))
  const options = candidates.filter((candidate) => !activeWallets.has(candidate.address.toLowerCase()))

  async function run(key: string, action: () => Promise<string | void>) {
    setBusy(key)
    setNotice(null)
    try {
      const message = await action()
      if (message) setNotice({ tone: 'ok', text: message })
    } catch (error) {
      setNotice({ tone: 'error', text: describeApiError(error) })
    } finally {
      setBusy(null)
    }
  }

  const download = () =>
    run('download', async () => {
      const file = await downloadPrivateDocument(doc.id)
      const actual = await sha256Hex(file.blob)
      saveBlob(file.blob, file.filename)
      return actual === doc.sha256
        ? 'Đã tải về. SHA-256 của tệp đã giải mã KHỚP với hash đã lưu khi tải lên.'
        : 'Đã tải về nhưng SHA-256 KHÔNG khớp hash đã lưu. Đừng tin nội dung tệp này.'
    })

  const grant = () =>
    run('grant', async () => {
      await grantDocumentAccess(doc.id, target)
      setTarget('')
      onChanged()
      return 'Đã cấp quyền đọc.'
    })

  const revoke = (wallet: string) =>
    run(`revoke:${wallet}`, async () => {
      await revokeDocumentAccess(doc.id, wallet)
      onChanged()
      return 'Đã thu hồi quyền đọc. Chỉ chặn các lần tải sau, không thu hồi được bản đã tải về.'
    })

  return (
    <Card className="farmer-detail-grants-card">
      <div className="farmer-detail-invoice-head">
        <div>
          <h2>Hóa đơn bán buôn</h2>
          <p>
            {formatSize(doc.size_bytes)} · tải lên {formatDate(doc.created_at)} · {doc.mime_type}
          </p>
          <p className="mono farmer-detail-wrap">SHA-256 (bản rõ): {doc.sha256}</p>
          <p className="mono farmer-detail-wrap">CID (chỉ chứa dữ liệu đã mã hóa): {doc.cid}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '14px 0' }}>
        <Button type="button" onClick={download} disabled={busy !== null}>
          {busy === 'download' ? 'Đang giải mã…' : 'Tải hóa đơn'}
        </Button>
      </div>

      {doc.can_manage ? (
        <>
          <h3>Ví được đọc hóa đơn</h3>
          {doc.grants.length === 0 ? (
            <p>Chưa cấp quyền cho ví nào. Chỉ bạn đọc được.</p>
          ) : (
            <div className="farmer-detail-grants-list">
              {doc.grants.map((grantRow) => (
                <div className="farmer-detail-grant-row" key={grantRow.wallet}>
                  <span className="farmer-detail-wallet">
                    <TraceIcon name="hash" /> {shortAddress(grantRow.wallet)}
                  </span>
                  <span>
                    {grantRow.revoked_at
                      ? `Đã thu hồi ${formatDate(grantRow.revoked_at)}`
                      : `Được cấp ${formatDate(grantRow.granted_at)}`}
                  </span>
                  {!grantRow.revoked_at && (
                    <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => revoke(grantRow.wallet)}>
                      {busy === `revoke:${grantRow.wallet}` ? 'Đang thu hồi…' : 'Thu hồi'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
            <div style={{ flex: '1 1 260px' }}>
              <Select
                label="Cấp quyền đọc cho"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                hint={options.length === 0 ? 'Không còn ví Logistics hoặc Retailer nào để cấp.' : undefined}
              >
                <option value="">Chọn ví…</option>
                {options.map((candidate) => (
                  <option key={candidate.address} value={candidate.address}>
                    {candidate.role} · {shortAddress(candidate.address)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" disabled={!target || busy !== null} onClick={grant}>
              {busy === 'grant' ? 'Đang cấp…' : 'Cấp quyền'}
            </Button>
          </div>
          <p className="farmer-detail-grant-disclaimer">
            Thu hồi chỉ chặn các lần tải sau. Bản đã tải về không thu hồi được. Quyền đọc luôn được kiểm lại với vai trò hiện tại trên hợp đồng.
          </p>
        </>
      ) : (
        <p>Bạn được người tải lên cấp quyền đọc hóa đơn này.</p>
      )}

      {notice && (
        <div className={notice.tone === 'error' ? 'state error' : 'state'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      )}
    </Card>
  )
}

/** Tab "Tài liệu riêng" của một lô: danh sách hóa đơn đã mã hóa, tải về và cấp / thu hồi quyền đọc. */
export function PrivateDocumentsPanel({ tokenId }: Props) {
  const [docs, setDocs] = useState<DocumentListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])

  const load = useCallback(() => {
    setError(null)
    listPrivateDocuments(tokenId).then(setDocs, (reason) => setError(describeApiError(reason)))
  }, [tokenId])

  useEffect(() => {
    setDocs(null)
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    Promise.all([listRoleMembers('logistics'), listRoleMembers('retailer')])
      .then(([logistics, retailers]) => {
        if (cancelled) return
        setCandidates([
          ...logistics.map((address) => ({ address, role: 'Logistics' })),
          ...retailers.map((address) => ({ address, role: 'Retailer' })),
        ])
      })
      .catch(() => {
        if (!cancelled) setCandidates([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="farmer-detail-private">
      <div className="farmer-detail-private-notice">
        <TraceIcon name="warn" />
        <div>
          <strong>Hóa đơn bán buôn riêng</strong>
          <p>Hóa đơn không công khai: được mã hóa trước khi lên IPFS và chỉ ví tải lên cùng ví được cấp quyền mới đọc được.</p>
        </div>
      </div>
      {error ? (
        <Card>
          <ErrorState
            title="Không thể đọc danh sách tài liệu"
            description={error}
            action={<Button type="button" onClick={load}>Thử lại</Button>}
          />
        </Card>
      ) : docs === null ? (
        <Card><LoadingState label="Đang tải tài liệu riêng…" /></Card>
      ) : docs.length === 0 ? (
        <Card>
          <EmptyState
            title="Lô này chưa có hóa đơn riêng"
            description="Hóa đơn được tải lên ở bước 3 khi tạo lô. Lô tạo mà không chọn hóa đơn thì chưa có tài liệu riêng."
          />
        </Card>
      ) : (
        docs.map((doc) => <DocumentCard key={doc.id} doc={doc} candidates={candidates} onChanged={load} />)
      )}
    </div>
  )
}
