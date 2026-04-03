/**
 * 인메모리 SMS 발송·검증 실패 레이트 리밋 (단일 인스턴스 기준).
 * 운영 다중 인스턴스에서는 Redis 등으로 교체 가능.
 */

const MIN_GAP_MS = 60_000
const SEND_WINDOW_MS = 60 * 60_000
const MAX_SENDS_PER_WINDOW = 5
const VERIFY_LOCKOUT_MS = 15 * 60_000
const MAX_VERIFY_FAILS = 5

/** @type {Map<string, { lastSendAt: number, windowStart: number, count: number }>} */
const sendState = new Map()
/** @type {Map<string, { fails: number, lockedUntil: number }>} */
const verifyFailState = new Map()

function sendKey(purpose, phoneDigits) {
  return `${String(purpose)}|${String(phoneDigits)}`
}

function verifyKey(purpose, phoneDigits, usernameOrUserId) {
  return `${String(purpose)}|${String(phoneDigits)}|${String(usernameOrUserId ?? '')}`
}

/**
 * @returns {{ ok: true } | { ok: false, message: string, retryAfterSec?: number }}
 */
export function assertCanRequestSmsCode(purpose, phoneDigits) {
  const key = sendKey(purpose, phoneDigits)
  const now = Date.now()
  let s = sendState.get(key)
  if (!s) {
    s = { lastSendAt: 0, windowStart: now, count: 0 }
    sendState.set(key, s)
  }
  if (now - s.windowStart > SEND_WINDOW_MS) {
    s.windowStart = now
    s.count = 0
  }
  if (s.count >= MAX_SENDS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((s.windowStart + SEND_WINDOW_MS - now) / 1000)
    return {
      ok: false,
      message: '인증번호 요청 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
      retryAfterSec: Math.max(1, retryAfterSec),
    }
  }
  if (now - s.lastSendAt < MIN_GAP_MS) {
    const retryAfterSec = Math.ceil((MIN_GAP_MS - (now - s.lastSendAt)) / 1000)
    return {
      ok: false,
      message: '인증번호는 1분 간격으로 다시 요청할 수 있습니다.',
      retryAfterSec: Math.max(1, retryAfterSec),
    }
  }
  s.lastSendAt = now
  s.count += 1
  return { ok: true }
}

/** 인증 실패 시 호출 */
export function recordVerifyFailure(purpose, phoneDigits, usernameOrUserId) {
  const key = verifyKey(purpose, phoneDigits, usernameOrUserId)
  const now = Date.now()
  let v = verifyFailState.get(key)
  if (!v) {
    v = { fails: 0, lockedUntil: 0 }
    verifyFailState.set(key, v)
  }
  if (now < v.lockedUntil) {
    return
  }
  v.fails += 1
  if (v.fails >= MAX_VERIFY_FAILS) {
    v.lockedUntil = now + VERIFY_LOCKOUT_MS
    v.fails = 0
  }
}

export function assertNotVerifyLocked(purpose, phoneDigits, usernameOrUserId) {
  const key = verifyKey(purpose, phoneDigits, usernameOrUserId)
  const v = verifyFailState.get(key)
  if (!v || v.lockedUntil <= Date.now()) {
    return { ok: true }
  }
  const retryAfterSec = Math.ceil((v.lockedUntil - Date.now()) / 1000)
  return {
    ok: false,
    message: '인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    retryAfterSec: Math.max(1, retryAfterSec),
  }
}

/** 인증 성공 시 실패 카운트 초기화 */
export function clearVerifyFailures(purpose, phoneDigits, usernameOrUserId) {
  verifyFailState.delete(verifyKey(purpose, phoneDigits, usernameOrUserId))
}
