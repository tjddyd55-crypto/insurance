/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @param {string} [label]
 * @returns {Promise<T>}
 */
export function promiseWithTimeout(promise, timeoutMs, label = 'timeout') {
  const ms = Math.max(1, Number(timeoutMs) || 1)
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} after ${ms}ms`))
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
