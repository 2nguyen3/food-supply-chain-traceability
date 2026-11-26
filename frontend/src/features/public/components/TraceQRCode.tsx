import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button, Card } from '../../../components/ui'
import { TraceIcon } from './TraceIcon'

export function TraceQRCode({ code, path: livePath }: { code: string; path?: string }) {
  const canvasHolder = useRef<HTMLDivElement>(null)
  const [feedback, setFeedback] = useState('')
  const path = livePath ?? `/trace/demo/${code}`
  const url = new URL(path, window.location.origin).toString()

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setFeedback('Đã sao chép liên kết.')
    } catch {
      setFeedback('Không thể sao chép tự động. Bạn có thể chọn và sao chép URL bên dưới.')
    }
  }

  function downloadQr() {
    const canvas = canvasHolder.current?.querySelector('canvas')
    if (!canvas) {
      setFeedback('Không thể tạo tệp QR. Vui lòng thử lại.')
      return
    }
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `qr-${code}.png`
    link.click()
    setFeedback('Đã tải ảnh QR.')
  }

  return (
    <Card className="trace-qr-card">
      <div className="trace-qr-image" ref={canvasHolder}>
        <div className="trace-qr-frame">
          <QRCodeCanvas
            value={url}
            size={512}
            level="M"
            marginSize={1}
            style={{ width: '100%', height: 'auto' }}
            aria-label={`Mã QR cho lô ${code}`}
          />
        </div>
        <strong>{code}</strong>
      </div>
      <div className="trace-qr-copy">
        <h3>Mã QR truy xuất</h3>
        <div className="trace-qr-actions">
          <Button variant="secondary" type="button" onClick={copyUrl}>
            <TraceIcon name="copy" /> Sao chép liên kết
          </Button>
          <Button variant="secondary" type="button" onClick={downloadQr}>
            <TraceIcon name="download" /> Tải mã QR
          </Button>
        </div>
        <details className="trace-qr-details">
          <summary>
            Thông tin kỹ thuật <TraceIcon name="down" />
          </summary>
          <div>
            <p>URL được mã hóa trong QR</p>
            <p className="trace-qr-url mono">{url}</p>
          </div>
        </details>
        {feedback && (
          <p className="trace-qr-feedback" role="status">
            {feedback}
          </p>
        )}
      </div>
    </Card>
  )
}
