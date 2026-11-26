/**
 * COCOMARK: bounded read-only JSON-RPC gateway for Ethereum Sepolia.
 * The SolidRPC credential is ONLY read from the server-side Vercel environment.
 * No chain data is cached in a database, and this endpoint never signs transactions.
 */
const METHODS = new Set([
  'eth_chainId',
  'net_version',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getCode',
  'eth_call',
  'eth_getLogs',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
])

const DEFAULT_ALLOWED_ORIGIN = 'https://cocomark.vercel.app'
const MAX_REQUEST_BYTES = 32 * 1024
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024
const MAX_LOG_SPAN = 8_000
const UPSTREAM_TIMEOUT_MS = 13_000

function hexBlock(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) return null
  const result = Number.parseInt(value.slice(2), 16)
  return Number.isSafeInteger(result) ? result : null
}

function validLogFilter(filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return false
  if (filter.blockHash) return /^0x[0-9a-f]{64}$/i.test(filter.blockHash)
  const from = hexBlock(filter.fromBlock)
  const to = hexBlock(filter.toBlock)
  return from !== null && to !== null && from <= to && to - from + 1 <= MAX_LOG_SPAN
}

function readOnlyRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  if (body.jsonrpc !== '2.0' || !METHODS.has(body.method)) return false
  if (!Array.isArray(body.params) || body.params.length > 5) return false
  if (typeof body.id !== 'string' && typeof body.id !== 'number') return false
  if (body.method === 'eth_getLogs') return body.params.length === 1 && validLogFilter(body.params[0])
  return true
}

function upstreamEndpoint() {
  const raw = process.env.SOLIDRPC_RPC_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    // Prevent arbitrary upstreams / SSRF by pinning the SolidRPC HTTPS host and chain.
    if (url.protocol !== 'https:' || url.hostname !== 'rpc.solidrpc.io') return null
    if (!/^\/[^/]+\/evm\/11155111$/.test(url.pathname) || url.search || url.hash) return null
    return raw
  } catch {
    return null
  }
}

/** Mask the exact secret URL if an upstream sends it inside an error body. */
function safeUpstreamMessage(value, endpoint) {
  const json = JSON.stringify(value)
  if (typeof json !== 'string') return null
  const key = new URL(endpoint).pathname.split('/')[1]
  const sanitized = json.replaceAll(endpoint, '[redacted-rpc-url]').replaceAll(key, '[redacted-key]')
  try {
    return JSON.parse(sanitized)
  } catch {
    return null
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'POST required' })
  }
  const expectedOrigin = process.env.RPC_ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN
  if (request.headers.origin !== expectedOrigin) {
    return response.status(403).json({ error: 'Origin not allowed' })
  }
  const endpoint = upstreamEndpoint()
  if (!endpoint) return response.status(503).json({ error: 'RPC gateway not configured' })

  let payload
  try {
    payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    const bodyText = JSON.stringify(payload)
    if (!bodyText || bodyText.length > MAX_REQUEST_BYTES || !readOnlyRequest(payload)) {
      return response.status(400).json({ error: 'Invalid or disallowed RPC request' })
    }
    // Forward only the well-formed JSON-RPC request, never client-supplied headers.
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyText,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    const upstreamText = await upstream.text()
    if (upstreamText.length > MAX_RESPONSE_BYTES) {
      return response.status(502).json({ error: 'Upstream response too large' })
    }
    let answer
    try {
      answer = JSON.parse(upstreamText)
    } catch {
      return response.status(502).json({ error: 'Invalid upstream RPC response' })
    }
    const safe = safeUpstreamMessage(answer, endpoint)
    if (safe === null) return response.status(502).json({ error: 'Invalid upstream RPC response' })
    // Keep the 429 and JSON-RPC error metadata so ethers can retry/adapt block spans.
    if (upstream.status === 429) response.setHeader('Retry-After', upstream.headers.get('retry-after') || '2')
    return response.status(upstream.status).json(safe)
  } catch {
    return response.status(502).json({ error: 'RPC upstream unavailable' })
  }
}
