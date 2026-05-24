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
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @returns {Promise<string>}
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
