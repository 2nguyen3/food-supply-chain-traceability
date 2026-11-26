import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

async function sourceModule(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'esm' })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}

const { imageFormat } = await sourceModule('src/lib/imageFormat.ts')
const { readResponseBytes } = await sourceModule('src/lib/readResponseBytes.ts')
const { sha256Hex } = await sourceModule('src/lib/hash.ts')

test('JPEG/PNG/WebP signatures, including lossless and extended WebP', () => {
  assert.equal(imageFormat(Uint8Array.of(255, 216, 255)), 'jpeg')
  assert.equal(imageFormat(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)), 'png')
  for (const chunk of ['VP8 ', 'VP8L', 'VP8X'])
    assert.equal(imageFormat(Buffer.from(`RIFF0000WEBP${chunk}original`)), 'webp')
  for (const text of ['<svg/>', 'GIF89a', '%PDF-1.7', 'RIFF0000WAVEVP8 ', 'RIFF0000WEBP'])
    assert.equal(imageFormat(Buffer.from(text)), undefined)
  assert.equal(imageFormat(Uint8Array.of(137, 80, 78, 71)), undefined)
})

test('retrieval and hashing preserve original bytes; changed bytes do not match', async () => {
  const original = Buffer.from('%PDF-1.7\noriginal\x00\xff', 'latin1')
  const retrieved = await readResponseBytes(new Response(original), original.length)
  assert.deepEqual(Buffer.from(retrieved), original)
  assert.equal(await sha256Hex(retrieved), await sha256Hex(original))
  assert.notEqual(await sha256Hex(retrieved), await sha256Hex(Buffer.concat([original, Buffer.from(' ')])))
})

test('large content-length rejected without reading body', async () => {
  await assert.rejects(readResponseBytes(new Response('12345', { headers: { 'content-length': '5' } }), 4), /FILE_TOO_LARGE/)
})

test('chunked oversized response rejected and stream cancelled', async () => {
  let cancelled = false
  const body = new ReadableStream({
    start(controller) { controller.enqueue(Uint8Array.of(1, 2, 3, 4, 5)) },
    cancel() { cancelled = true },
  })
  await assert.rejects(readResponseBytes(new Response(body), 4), /FILE_TOO_LARGE/)
  assert.equal(cancelled, true)
})
