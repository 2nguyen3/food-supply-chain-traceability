import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { Button, Card } from '../../../components/ui'

export function TraceQRCode({ code }: { code: string }) {
  const canvasHolder = useRef<HTMLDivElement>(null)
  const [feedback, setFeedback] = useState('')
  const path = `/trace/demo/${code}`
  const url = new URL(path, window.location.origin).toString()

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url)
      setFeedback('Đã sao chép liên kết demo.')
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
    link.download = `qr-demo-${code}.png`
    link.click()
    setFeedback('Đã tải ảnh QR của URL demo.')
  }

  return (
    <Card className="trace-qr-card">
      <div className="trace-qr-image" ref={canvasHolder}>
        <QRCodeCanvas
          value={url}
          size={512}
          level="M"
          marginSize={1}
          aria-label={`Mã QR demo cho lô ${code}`}
        />
        <strong>{code}</strong>
      </div>
      <div className="trace-qr-copy">
        <h3>Mã QR truy xuất</h3>
        <p>
          QR này mở URL demo công khai. URL production sẽ dùng chainId, địa chỉ hợp đồng và tokenId
          sau khi triển khai thật.
        </p>
        <div className="trace-qr-actions">
          <Button variant="secondary" type="button" onClick={copyUrl}>
            Sao chép liên kết
          </Button>
          <Link className="button secondary" to={path} target="_blank" rel="noopener noreferrer">
            Mở trang demo
          </Link>
          <Button variant="secondary" type="button" onClick={downloadQr}>
            Tải mã QR
          </Button>
        </div>
        <p className="trace-qr-url mono">{url}</p>
        <p className="trace-qr-warning">
          URL demo khác URL production; QR không chứa khóa riêng, hóa đơn hay trạng thái lô.
        </p>
        {feedback && (
          <p className="trace-qr-feedback" role="status">
            {feedback}
          </p>
        )}
      </div>
    </Card>
  )
}
