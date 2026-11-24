import { JsonRpcProvider, type Contract, type EventLog, type Log } from 'ethers'

type ChainLog = EventLog | Log
type History = { from: number; through: number; logs: ChainLog[] }
const histories = new Map<string, History>()
const spans = new Map<string, number>()
let queue: Promise<unknown> = Promise.resolve()
let nextRequestAt = 0

function checkAbort(signal?: AbortSignal) {
  signal?.throwIfAborted()
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  const value = error as Record<string, unknown>
  return [value.code, value.message, value.shortMessage, value.status,
    value.error && errorText(value.error), value.info && errorText(value.info),
    value.response && errorText(value.response)].filter(Boolean).join(' ')
}

function rangeLimited(error: unknown) {
  return /block range|block.*range.*limit|up to .*blocks|too many results|response size|query returned more/i.test(errorText(error))
}

function retryable(error: unknown) {
  return /429|too many requests|rate limit|throughput|NETWORK_ERROR|TIMEOUT|failed to fetch|502|503|504/i.test(errorText(error))
}

// Serialize log scans across dashboard readers, including overlapping mounts.
function scheduled<T>(read: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const result = queue.then(async () => {
    checkAbort(signal)
    await new Promise(resolve => setTimeout(resolve, Math.max(0, nextRequestAt - Date.now())))
    checkAbort(signal)
    nextRequestAt = Date.now() + 350
    return read()
  })
  queue = result.catch(() => undefined)
  return result
}

async function readWithRetry<T>(read: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await scheduled(read, signal)
    } catch (error) {
      checkAbort(signal)
      if (!retryable(error) || attempt >= 3) throw error
      const delay = 1000 * 2 ** attempt + Math.random() * 250
      nextRequestAt = Math.max(nextRequestAt, Date.now() + delay)
    }
  }
}

function endpointOf(contract: Contract): string | undefined {
  const provider = contract.runner?.provider
  return provider instanceof JsonRpcProvider ? provider._getConnection().url : undefined
}

/**
 * Truy vấn sự kiện theo khoảng block [from, latest]. RPC miễn phí thường giới hạn khoảng block của
 * eth_getLogs. Chỉ thu nhỏ khoảng khi RPC báo giới hạn block; lỗi mạng/429 được thử lại có giới hạn.
 */
export function makeLogQuery(contract: Contract, from: number, latest: number, signal?: AbortSignal) {
  const endpoint = endpointOf(contract)
  const cacheable = endpoint && !/\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/)/i.test(endpoint)
  return async (name: string, ...filterArgs: unknown[]): Promise<(EventLog | Log)[]> => {
    checkAbort(signal)
    const key = cacheable ? JSON.stringify([endpoint, contract.target, name, filterArgs], (_, value) =>
      typeof value === 'bigint' ? value.toString() : value) : undefined
    const history = key ? histories.get(key) : undefined
    const filter = contract.filters[name](...filterArgs)
    // Re-read the recent tail so new receipts and short reorganizations remain visible.
    let start = from
    if (history?.from === from && latest >= history.through) start = Math.max(from, history.through - 11)
    const found: ChainLog[] = history && start > from ? history.logs.filter(log => log.blockNumber < start) : []
    let span = (endpoint && spans.get(endpoint)) || Number.MAX_SAFE_INTEGER
    while (start <= latest) {
      checkAbort(signal)
      const end = Math.min(start + span - 1, latest)
      try {
        found.push(...await readWithRetry(() => contract.queryFilter(filter, start, end), signal))
        checkAbort(signal)
        start = end + 1
      } catch (error) {
        checkAbort(signal)
        if (!rangeLimited(error) || end === start) throw error
        const advertised = errorText(error).match(/up to (?:a )?(\d+)[ -]*block/i)
        span = advertised ? Math.max(1, Number(advertised[1])) : Math.max(1, Math.floor((end - start + 1) / 2))
        if (span > end - start) span = Math.max(1, Math.floor((end - start + 1) / 2))
        if (endpoint) spans.set(endpoint, span)
      }
    }
    if (key) {
      histories.delete(key)
      histories.set(key, { from, through: latest, logs: found })
      if (histories.size > 32) histories.delete(histories.keys().next().value!)
    }
    return found
  }
}

type Args = Record<string, unknown>

/** Đọc tham số có tên của một log sự kiện đã giải mã. */
export function argsOf(log: Log | EventLog): Args {
  const named = log as EventLog
  return (
    named.args
      ? Object.fromEntries(named.fragment.inputs.map((input, index) => [input.name, named.args[index]]))
      : {}
  ) as Args
}
