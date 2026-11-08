import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import jsQR from 'jsqr'

const MAX_SIDE = 1280

function readQr(source: CanvasImageSource, width: number, height: number, both: boolean) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(source, 0, 0, w, h)
  const { data } = context.getImageData(0, 0, w, h)
  return jsQR(data, w, h, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' })?.data ?? null
}

function cameraError(error: unknown): string {
  const name = (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Trình duyệt chưa được cấp quyền dùng camera. Hãy cho phép camera hoặc chọn ảnh QR.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'Không tìm thấy camera trên thiết bị này. Hãy chọn ảnh QR.'
  if (name === 'NotReadableError') return 'Camera đang được ứng dụng khác sử dụng.'
  return 'Không mở được camera. Hãy thử lại hoặc chọn ảnh QR.'
}

/** Quét mã QR bằng camera hoặc từ ảnh; gọi onDetect với nội dung chuỗi của mã. */
export function useQrScanner(onDetect: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef(0)
  const onDetectRef = useRef(onDetect)
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    onDetectRef.current = onDetect
  }, [onDetect])

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setActive(false)
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(async () => {
    setMessage('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessage('Camera chỉ dùng được trên HTTPS hoặc localhost. Hãy chọn ảnh QR.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setActive(true)
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      const tick = () => {
        const current = videoRef.current
        if (!current || !streamRef.current) return
        if (current.readyState >= 2 && current.videoWidth > 0) {
          const text = readQr(current, current.videoWidth, current.videoHeight, false)
          if (text) {
            stop()
            onDetectRef.current(text)
            return
          }
        }
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
    } catch (error) {
      stop()
      setMessage(cameraError(error))
    }
  }, [stop])

  const toggleCamera = useCallback(() => {
    if (streamRef.current) stop()
    else void start()
  }, [start, stop])

  const fromFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      setMessage('')
      try {
        const bitmap = await createImageBitmap(file)
        const text = readQr(bitmap, bitmap.width, bitmap.height, true)
        bitmap.close()
        if (text) {
          stop()
          onDetectRef.current(text)
        } else {
          setMessage('Không đọc được mã QR trong ảnh. Hãy chọn ảnh rõ nét, thấy đủ cả mã.')
        }
      } catch {
        setMessage('Không mở được tệp ảnh này.')
      }
    },
    [stop],
  )

  return { videoRef, active, message, toggleCamera, fromFile }
}

export type QrScanner = ReturnType<typeof useQrScanner>
