/**
 * app_settings 읽기 전용 캐시 (서버 인스턴스 단위 in-memory, TTL 5초)
 *
 * - 정책 판정(evaluateSubscription)이 로그인·/me·각 업무 API 에서 매 요청마다 일어나기 때문에
 *   DB hit 를 그대로 풀면 핫 패스 비용이 된다. 읽기만 하는 환경 설정이라 단순 TTL 캐시로 충분.
 * - 관리자 변경 직후 최대 5초 지연 후 모든 프로세스에 반영된다. 강제 반영이 필요한 운영 시나리오에서는
 *   `invalidateAppSettingsCache()` 를 관리자 PATCH 핸들러에서 호출한다.
 *
 * 확장 시 가이드:
 * - 키가 늘어나면 각 read 함수를 추가하되, 캐시 구조(Map<string, {value, at}>)는 그대로 유지.
 * - 다중 인스턴스 환경에서 실시간 반영이 필요해지면 Redis pub/sub 또는 Postgres LISTEN/NOTIFY 로 교체.
 */

import pool from '../db.js'

const CACHE_TTL_MS = 5_000

/** @type {Map<string, { value: unknown; at: number }>} */
const cache = new Map()

/**
 * @param {string} key
 * @returns {Promise<unknown>}
 */
async function readSetting(key) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value
  }
  const { rows } = await pool.query(
    `SELECT value_json FROM app_settings WHERE key = $1 LIMIT 1`,
    [key],
  )
  const raw = rows[0]?.value_json
  cache.set(key, { value: raw ?? null, at: Date.now() })
  return raw ?? null
}

/**
 * 정책 활성화 스위치. 누락·오류 시 보수적으로 false(=전원 통과, 정책 비활성).
 *
 * @returns {Promise<boolean>}
 */
export async function readPolicyActive() {
  try {
    const raw = await readSetting('subscription.policy_active')
    return raw === true
  } catch (error) {
    console.error('[appSettings] readPolicyActive 실패 → false 로 폴백:', error)
    return false
  }
}

/**
 * TRIAL 기본 일수. 범위 밖/파싱 실패 시 30 으로 폴백.
 *
 * @returns {Promise<number>}
 */
export async function readTrialDefaultDays() {
  try {
    const raw = await readSetting('subscription.trial_default_days')
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(n) && n >= 1 && n <= 365) {
      return Math.floor(n)
    }
    return 30
  } catch (error) {
    console.error('[appSettings] readTrialDefaultDays 실패 → 30 으로 폴백:', error)
    return 30
  }
}

/** 관리자 PATCH 직후 호출하면 다음 요청부터 새 값을 보게 된다. */
export function invalidateAppSettingsCache(key) {
  if (typeof key === 'string') {
    cache.delete(key)
    return
  }
  cache.clear()
}

/**
 * TRIAL 기본 일수 설정 쓰기.
 *
 * - 정책 활성 직후 "체험 기간" 의 근거가 되는 값이라 관리자만 변경할 수 있어야 한다.
 * - 쓰기 후 반드시 캐시를 무효화하여 다음 평가에서 새 값을 읽게 한다.
 * - 범위 검증은 호출 측(엔드포인트)에서 수행한다. 이 함수는 단순 쓰기 전담.
 *
 * @param {number} value
 * @param {string|null|undefined} updatedByUserId
 */
export const SIGNUP_WELCOME_SMS_MESSAGE_KEY = 'signup.welcome_sms_message'

const SIGNUP_WELCOME_SMS_MESSAGE_MAX_LEN = 2000

/**
 * 가입 안내 문자 본문 (관리자 설정). 없거나 유효하지 않으면 null → 발송부에서 기본 문구 fallback.
 *
 * @returns {Promise<string | null>}
 */
export async function readSignupWelcomeSmsMessage() {
  try {
    const raw = await readSetting(SIGNUP_WELCOME_SMS_MESSAGE_KEY)
    if (typeof raw !== 'string') {
      return null
    }
    const trimmed = raw.trim()
    if (!trimmed) {
      return null
    }
    if (trimmed.length > SIGNUP_WELCOME_SMS_MESSAGE_MAX_LEN) {
      return null
    }
    return raw
  } catch (error) {
    console.error('[appSettings] readSignupWelcomeSmsMessage 실패 → null 로 폴백:', error)
    return null
  }
}

/**
 * 관리자 UI용 — custom 설정 행 메타.
 *
 * @returns {Promise<{ message: string, updatedAt: string, updatedByUserId: string | null } | null>}
 */
export async function readSignupWelcomeSmsMessageCustomMeta() {
  try {
    const { rows } = await pool.query(
      `
      SELECT value_json, updated_at, updated_by_user_id
      FROM app_settings
      WHERE key = $1
      LIMIT 1
      `,
      [SIGNUP_WELCOME_SMS_MESSAGE_KEY],
    )
    const row = rows[0]
    if (!row) {
      return null
    }
    const raw = row.value_json
    if (typeof raw !== 'string') {
      return null
    }
    const trimmed = raw.trim()
    if (!trimmed) {
      return null
    }
    return {
      message: raw,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      updatedByUserId: row.updated_by_user_id != null ? String(row.updated_by_user_id) : null,
    }
  } catch (error) {
    console.error('[appSettings] readSignupWelcomeSmsMessageCustomMeta 실패:', error)
    return null
  }
}

/**
 * @param {string | null | undefined} value null이면 key 삭제(기본 문구 복원)
 * @param {string|null|undefined} updatedByUserId
 * @returns {Promise<string | null>}
 */
export async function writeSignupWelcomeSmsMessage(value, updatedByUserId = null) {
  if (value === null || value === undefined) {
    await pool.query(`DELETE FROM app_settings WHERE key = $1`, [SIGNUP_WELCOME_SMS_MESSAGE_KEY])
    invalidateAppSettingsCache(SIGNUP_WELCOME_SMS_MESSAGE_KEY)
    return null
  }
  if (typeof value !== 'string') {
    throw Object.assign(new Error('문자 내용은 문자열이어야 합니다.'), { httpStatus: 400 })
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw Object.assign(new Error('문자 내용을 입력해 주세요.'), { httpStatus: 400 })
  }
  if (value.length > SIGNUP_WELCOME_SMS_MESSAGE_MAX_LEN) {
    throw Object.assign(new Error(`문자 내용은 ${SIGNUP_WELCOME_SMS_MESSAGE_MAX_LEN}자 이하로 입력해 주세요.`), {
      httpStatus: 400,
    })
  }
  await pool.query(
    `
    INSERT INTO app_settings (key, value_json, updated_at, updated_by_user_id)
    VALUES ($1, $2::jsonb, NOW(), $3)
    ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_at = NOW(),
          updated_by_user_id = EXCLUDED.updated_by_user_id
    `,
    [SIGNUP_WELCOME_SMS_MESSAGE_KEY, JSON.stringify(value), updatedByUserId ?? null],
  )
  invalidateAppSettingsCache(SIGNUP_WELCOME_SMS_MESSAGE_KEY)
  return value
}

export async function writeTrialDefaultDays(value, updatedByUserId = null) {
  const normalized = Math.floor(Number(value))
  if (!Number.isFinite(normalized) || normalized < 1 || normalized > 365) {
    throw new Error(`TRIAL 기본 일수는 1~365 범위여야 합니다 (입력: ${value}).`)
  }
  await pool.query(
    `
    INSERT INTO app_settings (key, value_json, updated_at, updated_by_user_id)
    VALUES ($1, $2::jsonb, NOW(), $3)
    ON CONFLICT (key) DO UPDATE
      SET value_json = EXCLUDED.value_json,
          updated_at = NOW(),
          updated_by_user_id = EXCLUDED.updated_by_user_id
    `,
    ['subscription.trial_default_days', JSON.stringify(normalized), updatedByUserId ?? null],
  )
  invalidateAppSettingsCache('subscription.trial_default_days')
  return normalized
}
