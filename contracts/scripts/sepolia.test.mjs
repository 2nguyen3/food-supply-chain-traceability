import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demoActors, rpcRequest, verifyDeployment } from './sepolia.mjs'

const deployer = '0x0000000000000000000000000000000000000001'
const address = '0x0000000000000000000000000000000000000002'
const txHash = `0x${'ab'.repeat(32)}`
const artifact = { abi: [], bytecode: '0x6001', deployedBytecode: '0x6002' }
function provider(overrides = {}) {
  return {
    getNetwork: async () => ({ chainId: 11155111n }),
    getTransactionReceipt: async () => ({ status: 1, contractAddress: address, blockNumber: 10, blockHash: txHash }),
    getTransaction: async () => ({ from: deployer, to: null, data: artifact.bytecode }),
    getCode: async () => artifact.deployedBytecode,
    getBlock: async () => ({ hash: txHash, timestamp: 1800000000 }),
    ...overrides,
  }
}

test('cấu hình ví và RPC: thiếu, trùng, zero-address, HTTP bị chặn', () => {
  assert.throws(() => demoActors({}), /SEPOLIA_FARMER_A/)
  const env = { SEPOLIA_FARMER_A: deployer, SEPOLIA_FARMER_B: address, SEPOLIA_LOGISTICS: '0x0000000000000000000000000000000000000003', SEPOLIA_RETAILER: '0x0000000000000000000000000000000000000004' }
  assert.equal(demoActors(env).farmerA, deployer)
  assert.throws(() => demoActors({ ...env, SEPOLIA_RETAILER: deployer }), /khác nhau/)
  assert.throws(() => demoActors({ ...env, SEPOLIA_FARMER_A: '0x0000000000000000000000000000000000000000' }), /hợp lệ/)
  assert.throws(() => rpcRequest('http://127.0.0.1:8545'), /HTTPS/)
  assert.equal(rpcRequest('https://example.test').timeout, 20000)
})

test('manifest chỉ lấy từ receipt thành công, bytecode đúng và block canonical', async () => {
  const result = await verifyDeployment(provider(), artifact, txHash, deployer)
  assert.equal(result.address, address)
  assert.equal(result.deployBlock, 10)
  assert.match(result.abiHash, /^0x[0-9a-f]{64}$/)
  assert.equal('rpcUrl' in result, false)
  assert.equal('privateKey' in result, false)
  await assert.rejects(verifyDeployment(provider({ getNetwork: async () => ({ chainId: 1n }) }), artifact, txHash, deployer), /Sepolia/)
  await assert.rejects(verifyDeployment(provider({ getTransactionReceipt: async () => null }), artifact, txHash, deployer), /biên nhận/)
  await assert.rejects(verifyDeployment(provider({ getTransactionReceipt: async () => ({ status: 0 }) }), artifact, txHash, deployer), /thành công/)
  await assert.rejects(verifyDeployment(provider({ getCode: async () => '0x' }), artifact, txHash, deployer), /Runtime/)
  await assert.rejects(verifyDeployment(provider({ getTransaction: async () => ({ from: deployer, to: null, data: '0x1234' }) }), artifact, txHash, deployer), /Bytecode/)
  await assert.rejects(verifyDeployment(provider({ getBlock: async () => ({ hash: 'other' }) }), artifact, txHash, deployer), /canonical/)
  await assert.rejects(verifyDeployment(provider(), artifact, txHash, address), /Ví deploy/)
})
