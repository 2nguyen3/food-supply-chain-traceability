/** Nhận diện định dạng từ byte gốc; không chuyển đổi nội dung ảnh. */
export function imageFormat(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)) return 'png'
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (bytes.length >= 16 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12, 16))) return 'webp'
  return undefined
}
