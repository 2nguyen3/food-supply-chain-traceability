import { useState, useRef } from 'react'
import { DashboardIcon } from '../../components/common/DashboardIcon'

export default function RetailerNewIncidentPage() {
  const [selectedBatch, setSelectedBatch] = useState('COCONUT-001')
  const [description, setDescription] = useState('')

  // State quản lý tệp JSON
  const [jsonFile, setJsonFile] = useState<string | null>(null)

  // State quản lý tệp PDF
  const [pdfFile, setPdfFile] = useState<string | null>(null)

  const [submitted, setSubmitted] = useState(false)
  const [incidents, setIncidents] = useState<Array<{ batch: string; desc: string; date: string }>>([])

  const jsonInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Bắt lỗi validation
  const isDescError = submitted && description.trim().length < 10
  const isJsonError = submitted && !jsonFile
  const isPdfError = submitted && !pdfFile

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)

    if (description.trim().length >= 10 && jsonFile && pdfFile) {
      setIncidents((prev) => [
        {
          batch: selectedBatch,
          desc: description,
          date: new Date().toLocaleDateString('vi-VN'),
        },
        ...prev,
      ])
      // Reset form sau khi gửi
      setDescription('')
      setJsonFile(null)
      setPdfFile(null)
      setSubmitted(false)
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#1E293B' }}>Báo cáo sự cố</h1>
        <p className="muted" style={{ margin: '6px 0 0 0', fontSize: 14 }}>
          Có thể báo cáo kể cả khi lô đã bán hoặc đã hết hạn. Đính kèm bằng chứng JSON và PDF.
        </p>
      </header>

      {/* Bố cục 2 cột */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.15fr) minmax(320px, 1fr)', gap: 32, alignItems: 'start' }}>
        {/* Cột trái: Form nhập liệu */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Lô liên quan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: '#2B241A' }}>Lô liên quan</label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="select"
              style={{
                width: '100%',
                background: '#FAF7F2',
                color: '#2B241A',
                border: '1px solid #E8E2D9',
                borderRadius: 14,
                padding: '12px 16px',
                fontSize: 14,
              }}
            >
              <option value="COCONUT-001">COCONUT-001 · Sold</option>
              <option value="COCONUT-002">COCONUT-002 · Sold</option>
              <option value="COCONUT-003">COCONUT-003 · Delivered</option>
            </select>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: selectedBatch === 'COCONUT-003' ? '#EAF5EC' : '#2A4D3B',
                  color: selectedBatch === 'COCONUT-003' ? '#1E7E34' : '#FFFFFF',
                }}
              >
                {selectedBatch === 'COCONUT-003' ? 'Delivered · Đã giao' : 'Sold · Đã bán'}
              </span>
            </div>
          </div>

          {/* Mô tả quan sát */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: '#2B241A' }}>Mô tả quan sát</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ví dụ: Một số trái có mùi lạ khi mở, ghi nhận lúc nhập kho."
              style={{
                width: '100%',
                resize: 'vertical',
                minHeight: 110,
                background: '#FFFFFF',
                padding: 14,
                borderRadius: 16,
                boxSizing: 'border-box',
                border: isDescError ? '1.5px solid #DC2626' : '1px solid #E8E2D9',
                outline: 'none',
                fontSize: 14,
                color: '#2B241A',
                fontFamily: 'inherit',
              }}
            />
            {isDescError ? (
              <div style={{ color: '#DC2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span>⚠</span> Mô tả cần ít nhất 10 ký tự.
              </div>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>
                Ít nhất 10 ký tự. Nêu những gì đã thấy, không kết luận nguyên nhân.
              </span>
            )}
          </div>

          {/* Bằng chứng JSON */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: '#2B241A' }}>Bằng chứng JSON</label>
            <input
              type="file"
              accept=".json"
              ref={jsonInputRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setJsonFile(`${file.name} (${Math.round(file.size / 1024)} KB)`)
                }
              }}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 14,
                  border: '1.5px solid #E8E2D9',
                  background: '#FFFFFF',
                  color: '#2B241A',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <DashboardIcon name="download" />
                <span>Chọn tệp</span>
              </button>

              <button
                type="button"
                onClick={() => setJsonFile('incident-evidence.json (2 KB)')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '9px 18px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'transparent',
                  color: '#2B241A',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EAF5EC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Dùng tệp mẫu
              </button>
            </div>

            {jsonFile && (
              <div style={{ color: '#16A34A', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span> {jsonFile}
              </div>
            )}

            {isJsonError && (
              <div style={{ color: '#DC2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠</span> Cần bằng chứng JSON.
              </div>
            )}
            {!isJsonError && !jsonFile && (
              <span className="muted" style={{ fontSize: 12 }}>Tệp .json mô tả quan sát</span>
            )}
          </div>

          {/* Bằng chứng PDF */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: '#2B241A' }}>Bằng chứng PDF</label>
            <input
              type="file"
              accept=".pdf"
              ref={pdfInputRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setPdfFile(`${file.name} (${Math.round(file.size / 1024)} KB)`)
                }
              }}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 14,
                  border: '1.5px solid #E8E2D9',
                  background: '#FFFFFF',
                  color: '#2B241A',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <DashboardIcon name="download" />
                <span>Chọn tệp</span>
              </button>

              <button
                type="button"
                onClick={() => setPdfFile('bien-ban-giam-dinh.pdf (1.4 MB)')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '9px 18px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'transparent',
                  color: '#2B241A',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EAF5EC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Dùng tệp mẫu
              </button>
            </div>

            {pdfFile && (
              <div style={{ color: '#16A34A', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✓</span> {pdfFile}
              </div>
            )}

            {isPdfError && (
              <div style={{ color: '#DC2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠</span> Cần bằng chứng PDF.
              </div>
            )}
            {!isPdfError && !pdfFile && (
              <span className="muted" style={{ fontSize: 12 }}>Tệp .pdf biên bản/ảnh chụp</span>
            )}
          </div>

          {/* Nút Submit Ký và gửi */}
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: 'inline-block',
                borderRadius: 16,
                border: '2px solid #275641',
                padding: 3,
              }}
            >
              <button
                type="submit"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#275641',
                  color: '#FFFFFF',
                  padding: '12px 26px',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <DashboardIcon name="flag" />
                <span>Ký và gửi reportIncident</span>
              </button>
            </div>
          </div>
        </form>

        {/* Cột phải: Sự cố đã báo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1E293B' }}>Sự cố đã báo</h2>
          {incidents.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '60px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderRadius: 20,
                border: '1px solid var(--line, #E8E2D9)',
                background: '#fff',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#EEF5EE',
                  color: '#275641',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <DashboardIcon name="flag" />
              </div>
              <strong style={{ fontSize: 15, color: '#1E293B' }}>Chưa có sự cố nào</strong>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {incidents.map((inc, i) => (
                <div key={i} className="card" style={{ padding: 16, borderRadius: 16, background: '#fff', border: '1px solid #E8E2D9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ color: '#1E293B' }}>{inc.batch}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>{inc.date}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{inc.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}