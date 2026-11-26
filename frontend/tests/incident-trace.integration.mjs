import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { ContractFactory, JsonRpcProvider, id } from 'ethers'
import { build } from 'esbuild'

test('truy ngược và thu hồi trên contract local riêng', { skip: !process.env.TRACE_TEST_RPC_URL }, async (t) => {
  const rpc = new URL(process.env.TRACE_TEST_RPC_URL)
  assert.equal(rpc.hostname, '127.0.0.1')
  assert.equal(rpc.protocol, 'http:')
  assert.notEqual(rpc.port, '8545', 'Không chạy trên node dữ liệu của người dùng')
  const provider = new JsonRpcProvider(rpc.href, undefined, { batchMaxCount: 1, cacheTimeout: -1 })
  provider.pollingInterval = 20
  assert.equal((await provider.getNetwork()).chainId, 31337n)
  const directory = await mkdtemp(join(tmpdir(), 'cocomark-trace-'))
  const files = new Map()
  let rpcRequests = 0
  let rejectedRanges = 0
  let rangeLimit = Infinity
  let wrongNetwork = false
  let gatewayUnavailable = false
  let gatewayDelay = 0
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/rpc') {
        const body = []
        for await (const chunk of request) body.push(chunk)
        const payload = JSON.parse(Buffer.concat(body).toString())
        rpcRequests += Array.isArray(payload) ? payload.length : 1
        assert.ok(!Array.isArray(payload), 'Reader cấu hình batchMaxCount=1')
        let result
        const filter = payload.params?.[0]
        if (wrongNetwork && payload.method === 'eth_chainId') result = { jsonrpc: '2.0', id: payload.id, result: '0x1' }
        else if (payload.method === 'eth_getLogs' && Number(BigInt(filter.toBlock) - BigInt(filter.fromBlock) + 1n) > rangeLimit) {
          rejectedRanges += 1
          result = { jsonrpc: '2.0', id: payload.id, error: { code: -32005, message: 'Test RPC block range limit' } }
        } else {
          result = await (await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).json()
        }
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(result))
      } else {
        if (gatewayDelay) await new Promise((done) => setTimeout(done, gatewayDelay))
        const bytes = files.get(request.url?.slice('/ipfs/'.length))
        response.statusCode = !gatewayUnavailable && bytes ? 200 : 503
        response.end(response.statusCode === 200 ? bytes : 'Test gateway unavailable')
      }
    } catch {
      response.statusCode = 500
      response.end('Test transport error')
    }
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const base = `http://127.0.0.1:${server.address().port}`
  let measurements
  try {
    const [admin, farmerA, farmerB, logistics, retailer] = await Promise.all([0, 1, 2, 3, 4].map((index) => provider.getSigner(index)))
    const artifact = JSON.parse(await readFile(process.env.TRACE_TEST_ARTIFACT ?? resolve('../contracts/artifacts/contracts/FoodTraceability.sol/FoodTraceability.json'), 'utf8'))
    const contract = await new ContractFactory(artifact.abi, artifact.bytecode, admin).deploy()
    await contract.waitForDeployment()
    const address = await contract.getAddress()
    const send = async (transaction) => (await transaction).wait()
    await send(contract.assignFarmer(farmerA.address, 'FARM-A'))
    await send(contract.assignFarmer(farmerB.address, 'FARM-B'))
    await send(contract.grantRole(id('LOGISTICS_ROLE'), logistics.address))
    await send(contract.grantRole(id('RETAILER_ROLE'), retailer.address))
    const certificate = Buffer.from('%PDF-1.4 certificate test fixture')
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')
    const metadata = Buffer.from(JSON.stringify({ certificateURI: 'ipfs://testcertificate0001', image: 'ipfs://testimage00000001', tempMin: 8, tempMax: 15, cultivar: 'Dừa xiêm', fertilizer: 'Hữu cơ' }))
    files.set('testcertificate0001', certificate); files.set('testimage00000001', image); files.set('testmetadata000001', metadata)
    const hashes = [metadata, certificate, image].map((bytes) => `0x${sha(bytes)}`)
    const now = (await provider.getBlock('latest')).timestamp
    for (const [code, group, farmer] of [['COCONUT-001', 'HG-A01', farmerA], ['COCONUT-002', 'HG-A01', farmerA], ['COCONUT-003', 'HG-A02', farmerA], ['COCONUT-004', 'HG-B01', farmerB]]) {
      await send(contract.connect(farmer).createBatch([code, group, 'Bến Tre', 1000, now, now + 86400], 'testmetadata000001', ...hashes))
    }
    const handover = async (token, from, to) => {
      await send(contract.connect(from).requestTransfer(token, to.address))
      const pending = await contract.getPendingTransfer(token)
      await send(contract.connect(to).acceptTransfer(token, pending.requestId, hashes))
    }
    await handover(1, farmerA, logistics)
    for (const [index, temperature] of [1000, 1200, 1800, 1300, 1100].entries())
      await send(contract.connect(logistics).recordTransit(1, index + 1, temperature, now, '10.77,106.70'))
    await handover(1, logistics, retailer)
    await send(contract.connect(retailer).markSold(1))
    await handover(2, farmerA, logistics); await handover(2, logistics, retailer)
    await handover(3, farmerA, logistics)
    const report = Buffer.from(JSON.stringify({ description: 'Báo cáo kiểm thử truy ngược, không phải kết luận thực phẩm.' }))
    files.set('testreport00000001', report)
    await send(contract.connect(retailer).reportIncident(1, 'testreport00000001', `0x${sha(report)}`))
    await symlink(resolve('node_modules'), join(directory, 'node_modules'), 'dir')
    await build({
      entryPoints: { admin: 'src/features/admin/services/adminChain.ts', public: 'src/features/public/services/publicChainReader.ts' },
      bundle: true, outdir: directory, outExtension: { '.js': '.mjs' }, platform: 'node', format: 'esm', external: ['ethers'],
      define: { 'import.meta.env': JSON.stringify({ VITE_CHAIN_ID: '31337', VITE_PUBLIC_RPC_URL: `${base}/rpc`, VITE_CONTRACT_ADDRESS: address, VITE_DEPLOY_BLOCK: '0', VITE_IPFS_GATEWAY: base }) },
    })
    const reader = await import(pathToFileURL(join(directory, 'admin.mjs')).href)
    const publicReader = await import(pathToFileURL(join(directory, 'public.mjs')).href)
    const read = () => reader.readAdminIncidentDetail(1, new AbortController().signal)
    await t.test('đúng Farmer/farm/nhóm, các lô liên quan, đối chứng, reading và ownership', async () => {
      const before = rpcRequests
      const result = await read()
      assert.equal(result.batch.batchCode, 'COCONUT-001')
      assert.equal(result.batch.farmer, farmerA.address)
      assert.equal(result.batch.farmId, 'FARM-A'); assert.equal(result.batch.harvestGroupId, 'HG-A01')
      assert.equal(result.batch.lifecycle, 'Sold'); assert.equal(result.batch.recalled, false)
      assert.deepEqual(result.related.map((batch) => batch.batchCode), ['COCONUT-002'])
      assert.deepEqual(result.sameFarmOtherGroup.map((batch) => batch.batchCode), ['COCONUT-003'])
      assert.deepEqual(result.otherFarm.map((batch) => batch.batchCode), ['COCONUT-004'])
      assert.deepEqual(result.readings.map((reading) => reading.temperatureC), [10, 12, 18, 13, 11])
      assert.equal(result.ownership.length, 3)
      assert.equal(result.incident.verifiedOnChain, true)
      assert.equal(result.report.verified, 'match')
      assert.equal(result.metrics.rpcCalls, rpcRequests - before)
    })
    await t.test('đo 5 lần đọc thật và tách thời gian IPFS', async () => {
      measurements = []
      gatewayDelay = 120
      for (let run = 1; run <= 5; run++) {
        const before = rpcRequests
        const result = await read()
        assert.equal(result.metrics.rpcCalls, rpcRequests - before)
        assert.ok(result.metrics.artifactDurationMs >= 100)
        assert.ok(result.metrics.durationMs >= result.metrics.chainDurationMs)
        measurements.push({ run, ...result.metrics })
      }
      gatewayDelay = 0
      t.diagnostic(JSON.stringify({ chainId: 31337, contract: address, measurements }))
    })
    await t.test('đếm cả RPC chia khoảng/retry khi endpoint giới hạn getLogs', async () => {
      rangeLimit = 12
      const before = rpcRequests
      const result = await read()
      assert.ok(rejectedRanges > 0)
      assert.equal(result.metrics.rpcCalls, rpcRequests - before)
      assert.deepEqual(result.related.map((batch) => batch.batchCode), ['COCONUT-002'])
      rangeLimit = Infinity
    })
    await t.test('hash báo cáo sai hoặc gateway lỗi không đổi phân loại lô', async () => {
      files.set('testreport00000001', Buffer.from('{"description":"Nội dung bị sửa"}'))
      let result = await read()
      assert.equal(result.report.verified, 'mismatch'); assert.equal(result.description, null)
      gatewayUnavailable = true
      result = await read()
      assert.equal(result.report.verified, 'unavailable')
      assert.deepEqual(result.related.map((batch) => batch.batchCode), ['COCONUT-002'])
      gatewayUnavailable = false
      files.set('testreport00000001', report)
    })
    await t.test('thu hồi từng lô; Sold và owner không đổi, đối chứng không bị thu hồi', async () => {
      const reason = Buffer.from(JSON.stringify({ kind: 'cocomark.recall-reason', version: 1, tokenId: '1', incidentId: 1, reasonText: 'Lý do kiểm thử đúng phạm vi' }))
      files.set('testreason00000001', reason)
      await send(contract.recallBatch(1, 1, 'testreason00000001', `0x${sha(reason)}`))
      let result = await read()
      assert.equal(result.batch.recalled, true); assert.equal(result.batch.lifecycle, 'Sold')
      assert.equal(result.batch.owner, retailer.address)
      assert.equal(result.recallReasonText, 'Lý do kiểm thử đúng phạm vi')
      assert.equal((await contract.getBatch(2)).recalled, false)
      files.set('testreason00000001', Buffer.from(reason.toString().replace('đúng phạm vi', 'bị thay đổi')))
      result = await read()
      assert.equal(result.recallArtifact.verified, 'mismatch'); assert.equal(result.recallReasonText, null)
      files.set('testreason00000001', reason)
      const publicResult = await publicReader.inspectPublicChain({ chainId: '31337', contractAddress: address, tokenId: '1' }, new AbortController().signal)
      assert.equal(publicResult.kind, 'ok')
      assert.equal(publicResult.batch.recalled, true); assert.equal(publicResult.batch.lifecycle, 'Sold')
      await assert.rejects(async () => (await contract.connect(retailer).requestTransfer(1, logistics.address)).wait())
      await send(contract.recallBatch(2, 1, 'testreason00000002', `0x${sha(Buffer.from('Test scope'))}`))
      assert.equal((await contract.getBatch(2)).recalled, true)
      assert.equal((await contract.getBatch(3)).recalled, false); assert.equal((await contract.getBatch(4)).recalled, false)
    })
    await t.test('sự cố không tồn tại, sai mạng và hủy request không trả kết quả giả', async () => {
      await assert.rejects(reader.readAdminIncidentDetail(999, new AbortController().signal), { kind: 'notFound' })
      wrongNetwork = true
      await assert.rejects(read(), { kind: 'network' })
      wrongNetwork = false
      const controller = new AbortController(); controller.abort()
      const before = rpcRequests
      await assert.rejects(reader.readAdminIncidentDetail(1, controller.signal), { name: 'AbortError' })
      assert.equal(rpcRequests, before)
    })
    if (process.env.TRACE_TEST_RESULTS) await writeFile(process.env.TRACE_TEST_RESULTS, JSON.stringify({ chainId: 31337, address, measuredAt: new Date().toISOString(), measurements }, null, 2))
  } finally {
    provider.destroy()
    server.closeAllConnections()
    await new Promise((done) => server.close(done))
    await rm(directory, { recursive: true, force: true })
  }
})
