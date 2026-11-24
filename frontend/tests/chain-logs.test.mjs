import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

const built = await build({
  stdin: { contents: "export { makeLogQuery } from './src/services/chainLogs.ts'; export { JsonRpcProvider } from 'ethers'", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
})
const { makeLogQuery, JsonRpcProvider } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)

function contract(read, endpoint) {
  return {
    target: '0x0000000000000000000000000000000000000001',
    runner: endpoint ? { provider: new JsonRpcProvider(endpoint) } : undefined,
    filters: { BatchCreated: () => ({}) },
    queryFilter: (_, from, to) => read(from, to),
  }
}

test('range limit splits without skipping blocks, then refreshes the recent tail', async () => {
  const calls = []
  const fake = contract(async (from, to) => {
    calls.push([from, to])
    if (to - from + 1 > 10) throw new Error('Under the Free tier plan: up to a 10 block range')
    return Array.from({ length: to - from + 1 }, (_, i) => ({ blockNumber: from + i }))
  }, 'https://range-test.invalid')
  assert.equal((await makeLogQuery(fake, 100, 129)('BatchCreated')).length, 30)
  assert.deepEqual(calls, [[100, 129], [100, 109], [110, 119], [120, 129]])
  calls.length = 0
  const refreshed = await makeLogQuery(fake, 100, 130)('BatchCreated')
  assert.deepEqual(calls, [[118, 127], [128, 130]])
  assert.equal(refreshed.length, 31)
  assert.equal(new Set(refreshed.map(log => log.blockNumber)).size, 31)
  fake.runner.provider.destroy()
})

test('429 retries the same range instead of shrinking it', async () => {
  const calls = []
  const fake = contract(async (from, to) => {
    calls.push([from, to])
    if (calls.length === 1) throw new Error('429 Too Many Requests')
    return []
  })
  assert.deepEqual(await makeLogQuery(fake, 10, 40)('BatchCreated'), [])
  assert.deepEqual(calls, [[10, 40], [10, 40]])
})

test('contract errors fail immediately and do not become empty results', async () => {
  let calls = 0
  const fake = contract(async () => { calls++; throw new Error('CALL_EXCEPTION') })
  await assert.rejects(makeLogQuery(fake, 0, 100)('BatchCreated'), /CALL_EXCEPTION/)
  assert.equal(calls, 1)
})

test('abort stops scanning before the next segment', async () => {
  const controller = new AbortController()
  let calls = 0
  const fake = contract(async () => { calls++; controller.abort(); return [] })
  await assert.rejects(makeLogQuery(fake, 0, 100, controller.signal)('BatchCreated'), { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('local chains are re-read after a reset and never use remote history', async () => {
  const calls = []
  const fake = contract(async (from, to) => { calls.push([from, to]); return [] }, 'http://127.0.0.1:8545')
  await makeLogQuery(fake, 1, 20)('BatchCreated')
  await makeLogQuery(fake, 1, 21)('BatchCreated')
  assert.deepEqual(calls, [[1, 20], [1, 21]])
  fake.runner.provider.destroy()
})
