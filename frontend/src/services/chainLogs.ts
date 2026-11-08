import type { Contract, EventLog, Log } from 'ethers'

/**
 * Truy vấn sự kiện theo khoảng block [from, latest]. RPC miễn phí thường giới hạn khoảng block của
 * eth_getLogs: thử cả khoảng một lần, bị từ chối thì chia đôi và nhớ độ dài đã chạy được cho các
 * truy vấn còn lại.
 */
export function makeLogQuery(contract: Contract, from: number, latest: number, signal?: AbortSignal) {
  let span = Number.MAX_SAFE_INTEGER
  return async (name: string, ...filterArgs: unknown[]): Promise<(EventLog | Log)[]> => {
    const filter = contract.filters[name](...filterArgs)
    const found: (EventLog | Log)[] = []
    let start = from
    while (start <= latest) {
      const end = Math.min(start + span - 1, latest)
      try {
        found.push(...((await contract.queryFilter(filter, start, end)) as (EventLog | Log)[]))
        start = end + 1
      } catch (error) {
        if (signal?.aborted) throw error
        if (end - start < 10) throw error
        span = Math.max(10, Math.floor((end - start + 1) / 2))
      }
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
