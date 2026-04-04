/**
 * SMS 인증 요청 IP 기반 제한 (인메모리, 단일 인스턴스).
 * 1분당 최대 5회, 1시간당 최대 20회.
 */

const MINUTE_MS = 60_000
const MAX_PER_MINUTE = 5
const HOUR_MS = 3_600_000
const MAX_PER_HOUR = 20

/** @type {Map<string, { minuteStart: number, minuteCount: number, hourStart: number, hourCount: number }>} */
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

/** 감사 로그용 User-Agent (길이 제한) */
export function getClientUserAgent(req) {
  const h = req.headers?.['user-agent']
  if (typeof h === 'string' && h.trim()) {
    return h.trim().slice(0, 512)
  }
  return ''
}

/**
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
export function assertSmsRequestIpLimit(req) {
  const ip = getClientIp(req)
  const now = Date.now()
  let e = ipStore.get(ip)
  if (!e) {
    e = { minuteStart: now, minuteCount: 0, hourStart: now, hourCount: 0 }
    ipStore.set(ip, e)
  }

  if (now - e.minuteStart >= MINUTE_MS) {
    e.minuteStart = now
    e.minuteCount = 0
  }
  if (now - e.hourStart >= HOUR_MS) {
    e.hourStart = now
    e.hourCount = 0
  }

  if (e.minuteCount >= MAX_PER_MINUTE) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((MINUTE_MS - (now - e.minuteStart)) / 1000)),
    }
  }
  if (e.hourCount >= MAX_PER_HOUR) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((HOUR_MS - (now - e.hourStart)) / 1000)),
    }
  }

  e.minuteCount += 1
  e.hourCount += 1
  return { ok: true }
}
