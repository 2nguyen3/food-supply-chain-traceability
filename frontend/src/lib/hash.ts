const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')

/** SHA-256 (hex thường, 64 ký tự) trên đúng byte của dữ liệu; tệp thì băm byte gốc, không băm CID. */
export async function sha256Hex(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes =
    data instanceof Blob
      ? await data.arrayBuffer()
      : data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data
  return toHex(await crypto.subtle.digest('SHA-256', bytes))
}

/** Hash hex 64 ký tự (có hoặc không có 0x) thành bytes32 để truyền vào hợp đồng. */
export function toBytes32(hex: string): `0x${string}` {
  const clean = hex.replace(/^0x/i, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(clean)) throw new Error('Hash phải là SHA-256 dạng hex 64 ký tự.')
  return `0x${clean}`
}

export const utf8Bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
