import { randomInt } from 'node:crypto'
import { systemQuery } from '../utils/dbSafeQuery.js'

/** 혼동 문자 O/0, I/1 제외 */
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERRAL_CODE_LENGTH = 6
const MAX_CODE_GENERATION_ATTEMPTS = 12

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeReferralCode(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function generateReferralCodeCandidate() {
  let out = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    out += REFERRAL_CODE_CHARS[randomInt(0, REFERRAL_CODE_CHARS.length)]
  }
  return out
}

/**
 * 사용자별 추천 코드 행 보장.
 * - 이미 있으면 기존 code 유지 (과거 고객등록/가입 링크 호환, DB 덮어쓰기 금지)
 * - 없을 때만 짧은 난수 생성: referral_codes.code 는 VARCHAR(8) 이라
 *   username(최대 50자)을 저장할 수 없음. 고객등록 링크 SSOT 는 username 이며
 *   이 테이블 코드는 legacy fallback·가입 추천 할인 호환용이다.
 */
export async function ensureReferralCodeForUser(executor, userId) {
  const uid = String(userId ?? '').trim()
  if (!uid) {
    throw new Error('referral_code_user_id_required')
  }

  const existing = await systemQuery(
    executor,
    `SELECT code FROM referral_codes WHERE owner_user_id = $1 LIMIT 1`,
    [uid],
  )
  if (existing.rows[0]?.code) {
    return String(existing.rows[0].code)
  }

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = generateReferralCodeCandidate()
    try {
      const ins = await systemQuery(
        executor,
        `
        INSERT INTO referral_codes (owner_user_id, code)
        VALUES ($1, $2)
        ON CONFLICT (owner_user_id) DO NOTHING
        RETURNING code
        `,
        [uid, code],
      )
      if (ins.rows[0]?.code) {
        return String(ins.rows[0].code)
      }
      const again = await systemQuery(
        executor,
        `SELECT code FROM referral_codes WHERE owner_user_id = $1 LIMIT 1`,
        [uid],
      )
      if (again.rows[0]?.code) {
        return String(again.rows[0].code)
      }
    } catch (e) {
      if (e?.code === '23505') {
        continue
      }
      throw e
    }
  }

  throw new Error('referral_code_generation_failed')
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} codeNorm
 * @returns {Promise<{ ownerUserId: string; code: string } | null>}
 */
export async function lookupReferralCodeOwner(executor, codeNorm) {
  const code = normalizeReferralCode(codeNorm)
  if (!code) {
    return null
  }
  const r = await systemQuery(
    executor,
    `
    SELECT rc.owner_user_id, rc.code
    FROM referral_codes rc
    INNER JOIN users u ON u.id = rc.owner_user_id AND u.is_deleted = false
    WHERE rc.code = $1
    LIMIT 1
    `,
    [code],
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  return {
    ownerUserId: String(row.owner_user_id),
    code: String(row.code),
  }
}
