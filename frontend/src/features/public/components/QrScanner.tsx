import { HomeIcon } from './HomeIcon'
import type { QrScanner } from './useQrScanner'

/** Hai nút biểu tượng đặt trong ô nhập: quét bằng camera và chọn ảnh QR. */
export function QrScanTools({ scanner }: { scanner: QrScanner }) {
  return (
    <div className="trace-scan-tools">
      <button
        type="button"
        className="trace-scan-tool"
        aria-pressed={scanner.active}
        aria-label={scanner.active ? 'Tắt camera' : 'Quét QR bằng camera'}
        title={scanner.active ? 'Tắt camera' : 'Quét QR bằng camera'}
        onClick={scanner.toggleCamera}
      >
        <HomeIcon name="camera" size={20} />
      </button>
      <label className="trace-scan-tool" title="Chọn ảnh có mã QR">
        <HomeIcon name="qr" size={20} />
        <span className="visually-hidden">Chọn ảnh có mã QR</span>
        <input type="file" accept="image/*" onChange={scanner.fromFile} />
      </label>
    </div>
  )
}

/** Khung xem camera và thông báo lỗi của bộ quét. */
export function QrScanView({ scanner }: { scanner: QrScanner }) {
  return (
    <div className="trace-scanner">
      <div className="trace-scanner-view" hidden={!scanner.active}>
        <video
          ref={scanner.videoRef}
          playsInline
          muted
          aria-label="Hình từ camera để quét mã QR"
        />
        <span className="trace-scanner-frame" aria-hidden="true" />
        <p>Đưa mã QR vào khung, giữ yên vài giây.</p>
      </div>
      {scanner.message && (
        <p className="trace-scanner-message" role="status">
          {scanner.message}
        </p>
      )}
    </div>
  )
}
