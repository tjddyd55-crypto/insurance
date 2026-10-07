/**
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} worker
 */
export async function runBoundedConcurrency(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : []
  const limit = Math.max(1, Math.min(concurrency, list.length || 1))
  const results = new Array(list.length)
  let nextIndex = 0

  async function drain() {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= list.length) {
        return
      }
      results[current] = await worker(list[current], current)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => drain()))
  return results
}
