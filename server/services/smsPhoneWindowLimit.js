/**
 * 동일 전화번호 10분 창 최대 3회 발송(성공 시에만 카운트) — 인메모리, 단일 인스턴스 기준.
 */

const WINDOW_MS = 600_000
const MAX_IN_WINDOW = 3

/** @type {Map<string, { start: number, count: number }>} */
const store = new Map()

function key(digits) {
  return String(digits ?? '').replace(/\D/g, '')
}

/**
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
export function assertPhoneSms10MinLimit(phoneDigits) {
  const k = key(phoneDigits)
  if (!k) {
    return { ok: true }
  }
  const now = Date.now()
  let e = store.get(k)
  if (!e || now - e.start > WINDOW_MS) {
    return { ok: true }
  }
  if (e.count >= MAX_IN_WINDOW) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((WINDOW_MS - (now - e.start)) / 1000)),
    }
  }
  return { ok: true }
}

/** 문자 발송 성공 직후 호출 */
export function recordPhoneSms10MinSend(phoneDigits) {
  const k = key(phoneDigits)
  if (!k) {
    return
  }
  const now = Date.now()
  let e = store.get(k)
  if (!e || now - e.start > WINDOW_MS) {
    e = { start: now, count: 0 }
    store.set(k, e)
  }
  e.count += 1
}
