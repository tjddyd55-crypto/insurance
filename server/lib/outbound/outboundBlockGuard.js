/**
 * QA/데모 테넌트 외부 발송 명시 차단 (T159).
 *
 * - 차단 대상: ga_companies.code 가 OUTBOUND_BLOCKED_GA_CODES(기본 `QA_DEMO`, 쉼표 구분)에 포함된 GA 소속 사용자.
 * - "credential 이 없으니 안 나간다"에 기대지 않는다. SMS·알림톡·Push·기타 외부 발송 직전에 이 게이트를 호출한다.
 * - 판정 실패(DB 오류 등) 시: QA 로 확정할 수 없으면 기존 로직 그대로(차단하지 않음).
 *   QA 로 판정되면 무조건 차단한다. 기존 운영 GA 는 코드가 목록에 없으므로 영향 없음.
 * - 로그는 한 줄, 비밀값/수신번호 없이.
 */

import { systemQuery } from '../../utils/dbSafeQuery.js'

export const OUTBOUND_BLOCKED_ERROR_CODE = 'outbound_blocked_qa_demo'
export const OUTBOUND_BLOCKED_SKIP_REASON = 'blocked_qa_demo'
export const OUTBOUND_BLOCKED_PUBLIC_MESSAGE = 'QA/데모 계정에서는 외부 발송(문자·알림톡·푸시)이 차단되어 있습니다.'

const DEFAULT_BLOCKED_GA_CODES = 'QA_DEMO'
const CACHE_TTL_MS = 60_000

/** @type {Map<string, { value: boolean, at: number }>} */
const gaCache = new Map()
/** @type {Map<string, { gaId: number | null, at: number }>} */
const userGaCache = new Map()

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Set<string>}
 */
export function resolveBlockedGaCodes(env = process.env) {
  const raw = env.OUTBOUND_BLOCKED_GA_CODES
  const source = raw == null || String(raw).trim() === '' ? DEFAULT_BLOCKED_GA_CODES : String(raw)
  const set = new Set(
    source
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  )
  // QA_DEMO 는 env 로 빼더라도 항상 차단 (실수로 비워 둔 경우 대비).
  set.add('QA_DEMO')
  return set
}

/**
 * @param {string | null | undefined} code
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isBlockedGaCode(code, env = process.env) {
  const c = String(code ?? '').trim().toUpperCase()
  if (!c) return false
  return resolveBlockedGaCodes(env).has(c)
}

export function clearOutboundBlockCache() {
  gaCache.clear()
  userGaCache.clear()
}

function toGaId(value) {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number | string | null | undefined} gaIdRaw
 * @returns {Promise<boolean>}
 */
export async function isGaOutboundBlocked(db, gaIdRaw) {
  const gaId = toGaId(gaIdRaw)
  if (gaId == null || !db) return false
  const key = String(gaId)
  const hit = gaCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value
  try {
    const r = await systemQuery(db, `SELECT code FROM ga_companies WHERE id = $1 LIMIT 1`, [gaId])
    const value = isBlockedGaCode(r.rows?.[0]?.code)
    gaCache.set(key, { value, at: Date.now() })
    return value
  } catch {
    return false
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string | null | undefined} userIdRaw
 * @returns {Promise<number | null>}
 */
async function resolveUserGaId(db, userIdRaw) {
  const userId = String(userIdRaw ?? '').trim()
  if (!userId || !db) return null
  const hit = userGaCache.get(userId)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.gaId
  try {
    const r = await systemQuery(db, `SELECT ga_id FROM users WHERE id::text = $1 LIMIT 1`, [userId])
    const gaId = toGaId(r.rows?.[0]?.ga_id)
    userGaCache.set(userId, { gaId, at: Date.now() })
    return gaId
  } catch {
    return null
  }
}

/**
 * 사용자 또는 GA 기준 차단 여부. 둘 중 하나라도 QA 로 판정되면 true.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ userId?: string | null, gaId?: number | string | null }} subject
 */
export async function isOutboundBlocked(db, subject = {}) {
  if (await isGaOutboundBlocked(db, subject.gaId)) return true
  if (subject.userId) {
    const userGa = await resolveUserGaId(db, subject.userId)
    if (userGa != null && (await isGaOutboundBlocked(db, userGa))) return true
  }
  return false
}

/**
 * @param {string} channel  예: 'sms', 'alimtalk', 'push', 'push_device_register'
 * @param {{ userId?: string | null, gaId?: number | string | null, path?: string, count?: number }} meta
 */
export function logOutboundBlocked(channel, meta = {}) {
  const parts = [
    `channel=${channel}`,
    meta.path ? `path=${meta.path}` : null,
    meta.gaId != null ? `ga_id=${meta.gaId}` : null,
    meta.userId ? `user=${String(meta.userId).slice(0, 8)}…` : null,
    meta.count != null ? `count=${meta.count}` : null,
  ].filter(Boolean)
  console.warn(`[security][outbound-block] ${OUTBOUND_BLOCKED_ERROR_CODE} ${parts.join(' ')}`)
}

export function createOutboundBlockedError() {
  const err = new Error(OUTBOUND_BLOCKED_ERROR_CODE)
  err.status = 403
  err.code = OUTBOUND_BLOCKED_ERROR_CODE
  err.publicMessage = OUTBOUND_BLOCKED_PUBLIC_MESSAGE
  return err
}

/**
 * 차단 대상이면 403 에러를 throw (로그 1줄).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {{ userId?: string | null, gaId?: number | string | null }} subject
 * @param {string} channel
 * @param {string} [path]
 */
export async function assertOutboundAllowed(db, subject, channel, path) {
  if (await isOutboundBlocked(db, subject)) {
    logOutboundBlocked(channel, { ...subject, path })
    throw createOutboundBlockedError()
  }
}

/**
 * Express 라우트용: 차단 시 403 JSON 응답을 보내고 true 반환.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} channel
 */
export async function respondIfOutboundBlocked(db, req, res, channel) {
  const subject = { userId: req.user?.id ?? null, gaId: req.user?.gaId ?? null }
  if (!(await isOutboundBlocked(db, subject))) return false
  logOutboundBlocked(channel, { ...subject, path: req.originalUrl?.split('?')[0] || req.path })
  res.status(403).json({
    success: false,
    error: OUTBOUND_BLOCKED_ERROR_CODE,
    code: OUTBOUND_BLOCKED_ERROR_CODE,
    message: OUTBOUND_BLOCKED_PUBLIC_MESSAGE,
  })
  return true
}

/**
 * 일괄 발송 대상 제외용: 차단 GA id 목록.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @returns {Promise<number[]>}
 */
export async function listOutboundBlockedGaIds(db) {
  const codes = [...resolveBlockedGaCodes()]
  try {
    const r = await systemQuery(db, `SELECT id FROM ga_companies WHERE UPPER(code) = ANY($1::text[])`, [codes])
    return r.rows.map((row) => toGaId(row.id)).filter((id) => id != null)
  } catch {
    return []
  }
}

const SKIPPABLE_OUTBOX_TABLES = new Set([
  'claim_alimtalk_outbox',
  'notification_push_outbox',
  'customer_registration_alimtalk_outbox',
])

/**
 * Outbox 처리기용: 차단 GA 의 대기 row 를 발송 없이 SKIPPED(blocked_qa_demo) 로 마킹.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {'claim_alimtalk_outbox' | 'notification_push_outbox' | 'customer_registration_alimtalk_outbox'} table
 * @param {number} gaId
 * @returns {Promise<number>}
 */
export async function skipOutboxRowsForBlockedGa(db, table, gaId) {
  if (!SKIPPABLE_OUTBOX_TABLES.has(table)) return 0
  const id = toGaId(gaId)
  if (id == null) return 0
  const permanent = table === 'notification_push_outbox' ? '' : ', permanent_failure = true'
  const r = await systemQuery(
    db,
    `
    UPDATE ${table}
    SET status = 'SKIPPED',
        last_error = '${OUTBOUND_BLOCKED_SKIP_REASON}'${permanent},
        updated_at = NOW()
    WHERE ga_id = $1
      AND status IN ('PENDING', 'FAILED')
    `,
    [id],
  )
  return Number(r.rowCount ?? 0)
}

/**
 * Outbox 처리기 GA 루프 진입 시 호출: 차단 GA 면 row 를 skip 마킹하고 true(= continue).
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {'claim_alimtalk_outbox' | 'notification_push_outbox' | 'customer_registration_alimtalk_outbox'} table
 * @param {number} gaId
 * @param {string} channel
 */
export async function skipIfOutboxGaBlocked(db, table, gaId, channel) {
  if (!(await isGaOutboundBlocked(db, gaId))) return false
  let count = 0
  try {
    count = await skipOutboxRowsForBlockedGa(db, table, gaId)
  } catch {
    count = 0
  }
  logOutboundBlocked(channel, { gaId, path: table, count })
  return true
}
