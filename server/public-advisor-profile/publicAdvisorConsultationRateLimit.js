import { createHash } from 'node:crypto'

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 8
const buckets = new Map()

/**
 * @param {string} ip
 */
export function consultationRateLimitKey(ip) {
  return createHash('sha256').update(`${ip}:advisor-consult`, 'utf8').digest('hex')
}

/**
 * @param {string} keyHash
 */
export function assertConsultationRateLimit(keyHash) {
  const now = Date.now()
  const entry = buckets.get(keyHash)
  if (!entry || now - entry.startedAt > WINDOW_MS) {
    buckets.set(keyHash, { startedAt: now, count: 1 })
    return { ok: true }
  }
  if (entry.count >= MAX_PER_WINDOW) {
    return { ok: false }
  }
  entry.count += 1
  return { ok: true }
}
