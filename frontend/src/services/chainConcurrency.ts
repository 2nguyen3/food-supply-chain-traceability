/**
 * Limit the number of NFT/role groups being loaded at once without caching
 * blockchain data. Each mapper still queries live RPC; output order is stable.
 * This avoids unbounded Promise.all fan-out when the number of NFTs grows.
 */
export async function mapChainBounded<T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
  concurrency = 3,
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new RangeError('concurrency must be a positive integer')

  const results = new Array<R>(items.length)
  let cursor = 0
  let stopped = false

  async function worker(): Promise<void> {
    while (!stopped) {
      signal?.throwIfAborted()
      const index = cursor++
      if (index >= items.length) return
      try {
        results[index] = await mapper(items[index], index)
      } catch (error) {
        stopped = true
        throw error
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}
