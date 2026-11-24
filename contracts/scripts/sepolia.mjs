import { Contract, FetchRequest, JsonRpcProvider, Wallet, ZeroAddress, ZeroHash, getAddress, formatEther, id, keccak256 } from 'ethers'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

class SetupError extends Error {}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const manifestPath = resolve(root, 'docs/deployments/sepolia.json')
const artifactPath = resolve(root, 'contracts/artifacts/contracts/FoodTraceability.sol/FoodTraceability.json')

export function demoActors(env) {
  const fields = ['SEPOLIA_FARMER_A', 'SEPOLIA_FARMER_B', 'SEPOLIA_LOGISTICS', 'SEPOLIA_RETAILER']
  const addresses = fields.map((field) => {
    try {
      const address = getAddress(env[field] ?? '')
      if (address === ZeroAddress) throw new SetupError()
      return address
    } catch { throw new SetupError(`Cần địa chỉ ví hợp lệ: ${field}`) }
  })
  if (new Set(addresses).size !== addresses.length) throw new SetupError('Bốn ví demo phải khác nhau.')
  return { farmerA: addresses[0], farmerB: addresses[1], logisticsAddress: addresses[2], retailer: addresses[3] }
}

export function rpcRequest(url) {
  let parsed
  try { parsed = new URL(url) } catch { throw new SetupError('Chưa cấu hình SEPOLIA_RPC_URL hợp lệ.') }
  if (parsed.protocol !== 'https:') throw new SetupError('RPC Sepolia phải dùng HTTPS.')
  const request = new FetchRequest(parsed.href)
  request.timeout = 20000
  return request
}

export async function verifyDeployment(provider, artifact, txHash, expectedDeployer) {
  if ((await provider.getNetwork()).chainId !== 11155111n) throw new SetupError('RPC không phải Ethereum Sepolia 11155111.')
  if (!/^0x[\da-f]{64}$/i.test(txHash ?? '')) throw new SetupError('Cần txHash deploy thật.')
  const [receipt, transaction] = await Promise.all([provider.getTransactionReceipt(txHash), provider.getTransaction(txHash)])
  if (!receipt || !transaction) throw new SetupError('Chưa tìm thấy giao dịch/biên nhận; không tạo manifest.')
  if (receipt.status !== 1 || !receipt.contractAddress || transaction.to !== null) throw new SetupError('Giao dịch không phải deploy thành công.')
  if (getAddress(transaction.from) !== getAddress(expectedDeployer)) throw new SetupError('Ví deploy không khớp ví cấu hình.')
  if (transaction.data.toLowerCase() !== artifact.bytecode.toLowerCase()) throw new SetupError('Bytecode giao dịch khác artifact hiện tại.')
  const code = await provider.getCode(receipt.contractAddress)
  if (code.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) throw new SetupError('Runtime bytecode không khớp artifact.')
  const block = await provider.getBlock(receipt.blockNumber)
  if (!block || block.hash !== receipt.blockHash) throw new SetupError('Block deploy không còn canonical.')
  return { chainId: 11155111, address: getAddress(receipt.contractAddress), deployBlock: receipt.blockNumber,
    txHash, blockHash: receipt.blockHash, deployer: getAddress(transaction.from),
    abiHash: keccak256(new TextEncoder().encode(JSON.stringify(artifact.abi))),
    runtimeBytecodeHash: keccak256(code), deployedAt: new Date(block.timestamp * 1000).toISOString() }
}

async function main() {
  const [command = 'preflight', txHash] = process.argv.slice(2)
  if (!['preflight', 'finalize', 'roles'].includes(command)) throw new SetupError('Dùng preflight | finalize <txHash> | roles [--apply].')
  const provider = new JsonRpcProvider(rpcRequest(process.env.SEPOLIA_RPC_URL), undefined, { batchMaxCount: 1 })
  try {
    if ((await provider.getNetwork()).chainId !== 11155111n) throw new SetupError('RPC không phải Ethereum Sepolia 11155111.')
    let wallet
    try { wallet = new Wallet(process.env.SEPOLIA_PRIVATE_KEY ?? '', provider) }
    catch { throw new SetupError('Chưa có SEPOLIA_PRIVATE_KEY hợp lệ; không gửi khóa trong chat.') }
    const actors = demoActors(process.env)
    const hardhatMnemonic = 'test test test test test test test test test test test junk'
    const { HDNodeWallet } = await import('ethers')
    const publicAccounts = new Set(Array.from({ length: 20 }, (_, index) => HDNodeWallet.fromPhrase(hardhatMnemonic, undefined, `m/44'/60'/0'/0/${index}`).address))
    if ([wallet.address, ...Object.values(actors)].some((address) => publicAccounts.has(address))) throw new SetupError('Không dùng tài khoản Hardhat công khai trên Sepolia.')
    if (Object.values(actors).includes(wallet.address)) throw new SetupError('Ví Admin deploy phải khác bốn ví nghiệp vụ.')
    const artifact = JSON.parse(await readFile(artifactPath, 'utf8'))
    for (const file of ['contracts/abi/FoodTraceability.json', 'backend/app/services/abi/FoodTraceability.json', 'frontend/src/contracts/FoodTraceability.json']) {
      const exported = JSON.parse(await readFile(resolve(root, file), 'utf8'))
      if (JSON.stringify(exported.abi) !== JSON.stringify(artifact.abi)) throw new SetupError(`ABI chưa đồng nhất: ${file}`)
    }
    if (command === 'preflight') {
      const balances = await Promise.all([wallet.address, ...Object.values(actors)].map(async (address) => ({ address, testEth: formatEther(await provider.getBalance(address)) })))
      const gas = await provider.estimateGas({ from: wallet.address, data: artifact.bytecode })
      const fees = await provider.getFeeData()
      const price = fees.maxFeePerGas ?? fees.gasPrice
      if (!price) throw new SetupError('RPC chưa trả phí gas hợp lệ.')
      console.log(JSON.stringify({ chainId: 11155111, deployer: wallet.address, actors, balances,
        deployGasEstimate: gas.toString(), estimatedDeployUpperEth: formatEther(gas * price * 120n / 100n) }, null, 2))
      if (await provider.getBalance(wallet.address) < gas * price * 120n / 100n) throw new SetupError('Ví Admin chưa đủ ETH test cho deploy và biên gas 20%.')
      if (balances.some((item) => Number(item.testEth) === 0)) throw new SetupError('Cần ETH test cho tất cả ví demo trước khi chạy luồng nghiệp vụ.')
      return
    }
    if (command === 'finalize') {
      const deployment = await verifyDeployment(provider, artifact, txHash, wallet.address)
      const contract = new Contract(deployment.address, artifact.abi, provider)
      if (!await contract.hasRole(ZeroHash, wallet.address)) throw new SetupError('Ví deploy không còn quyền Admin.')
      const manifest = { ...deployment, ...actors,
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        dirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
        roleTransactions: [] }
      let previous
      try { previous = JSON.parse(await readFile(manifestPath, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (previous && previous.txHash !== txHash) throw new SetupError('Manifest đã thuộc deployment khác; không ghi đè.')
      if (previous) for (const field of Object.keys(actors)) if (actors[field] !== previous[field]) throw new SetupError(`Ví ${field} khác manifest cũ.`)
      if (previous) manifest.roleTransactions = previous.roleTransactions ?? []
      await mkdir(dirname(manifestPath), { recursive: true })
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
      console.log(`Đã lưu deployment thật: ${manifestPath}`)
      return
    }
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const deployment = await verifyDeployment(provider, artifact, manifest.txHash, wallet.address)
    if (deployment.address !== manifest.address || deployment.deployBlock !== manifest.deployBlock) throw new SetupError('Manifest khác receipt deploy.')
    for (const field of Object.keys(actors)) if (actors[field] !== manifest[field]) throw new SetupError(`Ví ${field} khác manifest.`)
    const contract = new Contract(manifest.address, artifact.abi, wallet)
    if (!await contract.hasRole(ZeroHash, wallet.address)) throw new SetupError('Ví hiện tại không có quyền Admin.')
    // Pending receipt phải được giải quyết trước khi tạo thêm giao dịch.
    for (const entry of manifest.roleTransactions ?? []) {
      const receipt = await provider.getTransactionReceipt(entry.txHash)
      if (!receipt) throw new SetupError(`Chờ receipt ${entry.txHash}; không gửi lại.`)
      entry.status = receipt.status === 1 ? 'confirmed' : 'failed'
    }
    const actions = []
    for (const [address, farm] of [[actors.farmerA, 'FARM-A'], [actors.farmerB, 'FARM-B']]) {
      const current = await contract.farmIdOf(address)
      if (current && current !== farm) throw new SetupError('Farmer đã gắn farmId khác; không ghi đè.')
      if (current !== farm || !await contract.hasRole(id('FARMER_ROLE'), address)) actions.push({ method: 'assignFarmer', args: [address, farm] })
    }
    for (const [role, address] of [['LOGISTICS_ROLE', actors.logisticsAddress], ['RETAILER_ROLE', actors.retailer]]) {
      if (!await contract.hasRole(id(role), address)) actions.push({ method: 'grantRole', args: [id(role), address] })
    }
    console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'read-only', actions }, null, 2))
    if (!process.argv.includes('--apply')) return
    for (const action of actions) {
      const tx = await contract[action.method](...action.args)
      manifest.roleTransactions.push({ ...action, txHash: tx.hash, status: 'pending' })
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
      const receipt = await tx.wait(1, 120000)
      if (!receipt || receipt.status !== 1) throw new SetupError(`Chưa xác nhận ${tx.hash}; kiểm receipt trước khi chạy lại.`)
      manifest.roleTransactions.at(-1).status = 'confirmed'
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
      console.log(`Đã xác nhận ${action.method}: https://sepolia.etherscan.io/tx/${tx.hash}`)
    }
    if (!await contract.hasRole(id('FARMER_ROLE'), actors.farmerA) || !await contract.hasRole(id('FARMER_ROLE'), actors.farmerB)
      || !await contract.hasRole(id('LOGISTICS_ROLE'), actors.logisticsAddress) || !await contract.hasRole(id('RETAILER_ROLE'), actors.retailer)) throw new SetupError('Chưa xác minh đủ role sau receipt.')
    console.log('Đã đọc lại quyền và farmId. Không tạo lô hoặc tự seed dữ liệu testnet.')
  } finally { provider.destroy() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { if (error instanceof SetupError) console.error(error.message); console.error('Bước Sepolia chưa hoàn tất. Kiểm tra cấu hình, RPC, số dư và receipt; không gửi lại giao dịch khi chưa rõ trạng thái. Chạy preflight để kiểm tra cấu hình.'); process.exitCode = 1 })
}
