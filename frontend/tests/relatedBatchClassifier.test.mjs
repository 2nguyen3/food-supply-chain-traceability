import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { classifyRelatedBatches } from '../src/features/admin/services/relatedBatchClassifier.ts'

const lot = (tokenId, farmId, harvestGroupId, recalled = false) => ({
  tokenId: String(tokenId), farmId, harvestGroupId, recalled,
})
const ids = (rows) => rows.map((item) => item.tokenId)

const incident = lot(1, 'FARM-A', 'HG-A01', true)

test('TC04-A: NFT #2 FARM-A/HG-A02 is comparison (real Sepolia scenario)', () => {
  const result = classifyRelatedBatches(incident, [incident, lot(2, 'FARM-A', 'HG-A02')])
  assert.deepEqual(ids(result.related), [])
  assert.deepEqual(ids(result.sameFarmOtherGroup), ['2'])
  assert.deepEqual(ids(result.otherFarm), [])
})

test('TC04-B: local NFT #3 FARM-A/HG-A01 is a candidate for investigation', () => {
  const result = classifyRelatedBatches(incident, [incident, lot(3, 'FARM-A', 'HG-A01')])
  assert.deepEqual(ids(result.related), ['3'])
  assert.deepEqual(ids(result.sameFarmOtherGroup), [])
})

test('TC04-C: different farm remains comparison, even with matching group ID', () => {
  const result = classifyRelatedBatches(incident, [incident, lot(4, 'FARM-B', 'HG-A01')])
  assert.deepEqual(ids(result.related), [])
  assert.deepEqual(ids(result.otherFarm), ['4'])
})

test('TC04-D: exclude the incident lot itself (no false self-candidate)', () => {
  const result = classifyRelatedBatches(incident, [incident])
  assert.deepEqual(result, { related: [], sameFarmOtherGroup: [], otherFarm: [] })
})

test('TC04-E: mixed groups classify exactly once, preserve source order', () => {
  const rows = [
    incident,
    lot(2, 'FARM-A', 'HG-A02'),
    lot(3, 'FARM-A', 'HG-A01'),
    lot(4, 'FARM-B', 'HG-A01'),
    lot(5, 'FARM-A', 'HG-A03'),
    lot(6, 'FARM-A', 'HG-A01'),
  ]
  const result = classifyRelatedBatches(incident, rows)
  assert.deepEqual(ids(result.related), ['3', '6'])
  assert.deepEqual(ids(result.sameFarmOtherGroup), ['2', '5'])
  assert.deepEqual(ids(result.otherFarm), ['4'])
  assert.equal(
    [...result.related, ...result.sameFarmOtherGroup, ...result.otherFarm].length,
    rows.length - 1,
  )
})

test('TC04-F: classification never changes recalled flags or source records', () => {
  const candidate = Object.freeze(lot(3, 'FARM-A', 'HG-A01', false))
  const control = Object.freeze(lot(2, 'FARM-A', 'HG-A02', false))
  const input = Object.freeze([incident, candidate, control])
  const result = classifyRelatedBatches(incident, input)
  assert.strictEqual(result.related[0], candidate)
  assert.strictEqual(result.sameFarmOtherGroup[0], control)
  assert.equal(candidate.recalled, false)
  assert.equal(control.recalled, false)
  assert.equal(incident.recalled, true)
})

test('TC04-G: Admin incident detail uses the EXACT classifier tested here', () => {
  const root = fileURLToPath(new URL('../src/features/admin/services/adminChain.ts', import.meta.url))
  const code = readFileSync(root, 'utf8')
  assert.match(code, /import\s*\{\s*classifyRelatedBatches\s*\}\s*from\s*['"]\.\/relatedBatchClassifier['"]/) 
  assert.match(code, /classifyRelatedBatches\(batch, batches\)/)
})
