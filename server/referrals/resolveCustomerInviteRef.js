/**
 * 고객등록 초대 링크 ref → 담당자 해석.
 * SSOT: username 우선, 기존 referral_codes 는 legacy fallback 만.
 * DB schema / 기존 referral_codes 행은 변경하지 않는다.
 */

import { systemQuery } from '../utils/dbSafeQuery.js'
import { normalizeReferralCode } from './referralCode.js'

/**
 * @param {unknown} role
 */
function normalizeUserRole(role) {
  return String(role ?? '')
    .trim()
    .toUpperCase()
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseGaId(raw) {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * @typedef {{
 *   ok: true,
 *   refUserId: string,
 *   refGaId: number,
 *   lookupMode: 'username' | 'legacy_referral_code',
 *   matchedUsername: string,
 * } | {
 *   ok: false,
 *   reason:
 *     | 'missing_ref'
 *     | 'missing_ga'
 *     | 'ga_unknown'
 *     | 'ga_inactive'
 *     | 'ref_not_found'
 *     | 'ref_ambiguous'
 *     | 'ref_not_allowed_role'
 *     | 'ref_no_ga'
 *     | 'ga_mismatch',
 *   message: string,
 *   lookupMode?: 'username' | 'legacy_referral_code' | null,
 * }} ResolveCustomerInviteRefResult
 */

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   ref: string,
 *   gaCodeNorm: string,
 * }} input
 * @returns {Promise<ResolveCustomerInviteRefResult>}
 */
export async function resolveCustomerInviteRef(executor, input) {
  const ref = String(input?.ref ?? '').trim()
  const gaCodeNorm = String(input?.gaCodeNorm ?? '')
    .trim()
    .toUpperCase()

  if (!ref) {
    return {
      ok: false,
      reason: 'missing_ref',
      message: '담당자 정보를 확인할 수 없습니다. 링크를 다시 확인해 주세요.',
      lookupMode: null,
    }
  }
  if (!gaCodeNorm) {
    return {
      ok: false,
      reason: 'missing_ga',
      message: '잘못된 접근입니다',
      lookupMode: null,
    }
  }

  const gaRow = await systemQuery(
    executor,
    `SELECT id, status FROM ga_companies WHERE code = $1 AND is_deleted = false`,
    [gaCodeNorm],
  )
  if (gaRow.rowCount === 0) {
    return {
      ok: false,
      reason: 'ga_unknown',
      message: '잘못된 접근입니다',
      lookupMode: null,
    }
  }
  if (String(gaRow.rows[0].status ?? '').toLowerCase() !== 'active') {
    return {
      ok: false,
      reason: 'ga_inactive',
      message: '잘못된 접근입니다',
      lookupMode: null,
    }
  }
  const gaId = parseGaId(gaRow.rows[0].id)
  if (gaId == null) {
    return {
      ok: false,
      reason: 'ga_unknown',
      message: '잘못된 접근입니다',
      lookupMode: null,
    }
  }

  const byUsername = await systemQuery(
    executor,
    `
    SELECT id, role, ga_id, username
    FROM users
    WHERE username = $1
      AND is_deleted = false
    `,
    [ref],
  )
  if (byUsername.rowCount > 1) {
    return {
      ok: false,
      reason: 'ref_ambiguous',
      message: '담당자 정보를 확인할 수 없습니다. 링크를 다시 확인해 주세요.',
      lookupMode: 'username',
    }
  }

  let lookupMode = /** @type {'username' | 'legacy_referral_code'} */ ('username')
  let userRow = byUsername.rows[0] ?? null

  if (!userRow) {
    const codeNorm = normalizeReferralCode(ref)
    if (!codeNorm) {
      return {
        ok: false,
        reason: 'ref_not_found',
        message: '담당자 정보를 확인할 수 없습니다. 링크를 다시 확인해 주세요.',
        lookupMode: 'username',
      }
    }
    const byLegacy = await systemQuery(
      executor,
      `
      SELECT u.id, u.role, u.ga_id, u.username
      FROM referral_codes rc
      INNER JOIN users u ON u.id = rc.owner_user_id AND u.is_deleted = false
      WHERE UPPER(TRIM(rc.code)) = $1
      `,
      [codeNorm],
    )
    if (byLegacy.rowCount > 1) {
      return {
        ok: false,
        reason: 'ref_ambiguous',
        message: '담당자 정보를 확인할 수 없습니다. 링크를 다시 확인해 주세요.',
        lookupMode: 'legacy_referral_code',
      }
    }
    if (byLegacy.rowCount === 0) {
      return {
        ok: false,
        reason: 'ref_not_found',
        message: '담당자 정보를 확인할 수 없습니다. 링크를 다시 확인해 주세요.',
        lookupMode: 'username',
      }
    }
    userRow = byLegacy.rows[0]
    lookupMode = 'legacy_referral_code'
  }

  if (normalizeUserRole(userRow.role) !== 'USER') {
    return {
      ok: false,
      reason: 'ref_not_allowed_role',
      message: '고객 정보를 받을 수 있는 계정이 아닙니다.',
      lookupMode,
    }
  }

  const userGaId = parseGaId(userRow.ga_id)
  if (userGaId == null) {
    return {
      ok: false,
      reason: 'ref_no_ga',
      message: '소개 계정에 GA가 연결되지 않았습니다.',
      lookupMode,
    }
  }
  if (userGaId !== gaId) {
    return {
      ok: false,
      reason: 'ga_mismatch',
      message: '잘못된 접근입니다',
      lookupMode,
    }
  }

  return {
    ok: true,
    refUserId: String(userRow.id),
    refGaId: gaId,
    lookupMode,
    matchedUsername: String(userRow.username ?? '').trim(),
  }
}
