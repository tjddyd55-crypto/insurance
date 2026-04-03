/**
 * SMS 인증 요청 IP 기반 간단 제한 (인메모리, 단일 인스턴스).
 * 60초 창당 최대 10회 (지시문 기준).
 */

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10

/** @type {Map<string, { count: number, start: number }>} */
const ipStore = new Map()

export function getClientIp(req) {
  const xff = req.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim()
  }
  if (Array.isArray(xff) && typeof xff[0] === 'string' && xff[0].trim()) {
    return xff[0].split(',')[0].trim()
  }
  if (typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim()
  }
  const ra = req.socket?.remoteAddress
  return typeof ra === 'string' && ra.trim() ? ra.trim() : 'unknown'
}

/**
 * @returns {{ ok: true } | { ok: false, message: string, retryAfterSec: number }}
 */
export function assertSmsRequestIpLimit(req) {
  const ip = getClientIp(req)
  const now = Date.now()
  let entry = ipStore.get(ip)
  if (!entry) {
    ipStore.set(ip, { count: 1, start: now })
    return { ok: true }
  }
  if (now - entry.start > WINDOW_MS) {
    ipStore.set(ip, { count: 1, start: now })
    return { ok: true }
  }
  if (entry.count >= MAX_PER_WINDOW) {
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - entry.start)) / 1000))
    return {
      ok: false,
      message: '요청이 너무 많습니다 (IP 제한).',
      retryAfterSec,
    }
  }
  entry.count += 1
  return { ok: true }
}
