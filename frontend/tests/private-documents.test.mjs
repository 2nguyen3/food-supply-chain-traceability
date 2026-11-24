import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/services/documentsApi.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: 'https://example.test' }) },
})
const service = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const original = Buffer.from('%PDF-1.7 private invoice\noriginal bytes')
const digest = createHash('sha256').update(original).digest('hex')

async function withResponse(response, work) {
  const previous = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.cache, 'no-store')
    return response
  }
  try { await work() } finally { globalThis.fetch = previous }
}

test('verified invoice returns exact bytes and filename only after hashes match', async () => {
  await withResponse(new Response(original, { headers: {
    'X-Document-Sha256': digest, 'Content-Disposition': 'attachment; filename="invoice.pdf"',
  } }), async () => {
    const file = await service.downloadVerifiedPrivateDocument('doc-id', digest.toUpperCase())
    assert.equal(file.filename, 'invoice.pdf')
    assert.deepEqual(Buffer.from(await file.blob.arrayBuffer()), original)
  })
})

test('changed bytes, mismatched list/header, missing header, malformed hash are blocked', async () => {
  for (const [bytes, expected, header] of [
    [Buffer.concat([original, Buffer.from('changed')]), digest, digest],
    [original, '0'.repeat(64), digest],
    [original, digest, '0'.repeat(64)],
    [original, digest, ''],
    [original, 'not-a-hash', digest],
  ]) {
    await withResponse(new Response(bytes, { headers: { 'X-Document-Sha256': header } }), async () => {
      await assert.rejects(service.downloadVerifiedPrivateDocument('doc-id', expected), { code: 'PRIVATE_HASH_MISMATCH' })
    })
  }
})

test('aborted document context cannot deliver a completed download', async () => {
  const controller = new AbortController()
  controller.abort()
  await withResponse(new Response(original, { headers: { 'X-Document-Sha256': digest } }), async () => {
    await assert.rejects(service.downloadVerifiedPrivateDocument('doc-id', digest, controller.signal), { name: 'AbortError' })
  })
})

test('revoked permission is surfaced without a downloadable blob', async () => {
  await withResponse(new Response(JSON.stringify({ error: { code: 'ACCESS_DENIED', message: 'Denied' } }), { status: 403 }), async () => {
    await assert.rejects(service.downloadVerifiedPrivateDocument('doc-id', digest), { code: 'ACCESS_DENIED', status: 403 })
  })
})
