import { readPolicyActive } from '../subscription/appSettings.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  ensureReferralCodeForUser,
  lookupReferralCodeOwner,
  normalizeReferralCode,
} from './referralCode.js'
import { computeReferralRelationshipStatus, referralStatusLabel } from './referralStatus.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} codeNorm
 * @returns {Promise<{ ok: true; referrerUserId: string; code: string } | { ok: false; message: string }>}
 */
export async function validateReferralCodeForSignup(executor, codeNorm) {
  const code = normalizeReferralCode(codeNorm)
  if (!code) {
    return { ok: true, referrerUserId: '', code: '' }
  }

  const owner = await lookupReferralCodeOwner(executor, code)
  if (owner) {
    const referrer = await systemQuery(
      executor,
      `SELECT id, status FROM users WHERE id = $1 AND is_deleted = false LIMIT 1`,
      [owner.ownerUserId],
    )
    const refRow = referrer.rows[0]
    if (!refRow) {
      return { ok: false, message: '유효하지 않은 추천인 코드입니다.' }
    }
    if (String(refRow.status ?? 'active').toLowerCase() !== 'active') {
      return { ok: false, message: '유효하지 않은 추천인 코드입니다.' }
    }
    return { ok: true, referrerUserId: owner.ownerUserId, code: owner.code }
  }

  /** 신규: 로그인 아이디(username) 를 추천 코드로 공유한 경우 */
  const byUsername = await systemQuery(
    executor,
    `
    SELECT id, status, username
    FROM users
    WHERE username = $1
      AND is_deleted = false
    LIMIT 2
    `,
    [String(codeNorm ?? '').trim()],
  )
  if (byUsername.rowCount === 0) {
    const byUsernameCi = await systemQuery(
      executor,
      `
      SELECT id, status, username
      FROM users
      WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
        AND is_deleted = false
      LIMIT 2
      `,
      [String(codeNorm ?? '').trim()],
    )
    if (byUsernameCi.rowCount !== 1) {
      return { ok: false, message: '유효하지 않은 추천인 코드입니다.' }
    }
    const row = byUsernameCi.rows[0]
    if (String(row.status ?? 'active').toLowerCase() !== 'active') {
      return { ok: false, message: '유효하지 않은 추천인 코드입니다.' }
    }
    return {
      ok: true,
      referrerUserId: String(row.id),
      code: String(row.username ?? '').trim() || code,
    }
  }
  if (byUsername.rowCount !== 1) {
    return { ok: false, message: '유효하지 않은 추천인 코드입니다.' }
  }
  const row = byUsername.rows[0]
  if (String(row.status ?? 'active').toLowerCase() !== 'active') {
    return { ok: false, message: '유효하지 않은 추천인 코드입니다.' }
  }
  return {
    ok: true,
    referrerUserId: String(row.id),
    code: String(row.username ?? '').trim() || code,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{
 *   referredUserId: string;
 *   referrerUserId: string;
 *   code: string;
 *   policyActive: boolean;
 * }} input
 */
export async function createReferralRelationship(client, input) {
  const referredUserId = String(input.referredUserId ?? '').trim()
  const referrerUserId = String(input.referrerUserId ?? '').trim()
  const code = normalizeReferralCode(input.code)

  if (!referredUserId || !referrerUserId || !code) {
    throw new Error('referral_relationship_invalid_input')
  }
  if (referrerUserId === referredUserId) {
    throw new Error('referral_self_not_allowed')
  }

  const dup = await systemQuery(
    client,
    `SELECT 1 FROM referral_relationships WHERE referred_user_id = $1 LIMIT 1`,
    [referredUserId],
  )
  if (dup.rowCount > 0) {
    throw new Error('referral_already_applied')
  }

  const referredRes = await systemQuery(
    client,
    `
    SELECT id, role, status, is_deleted, subscription_plan, subscription_started_at, subscription_expires_at
    FROM users
    WHERE id = $1 AND is_deleted = false
    LIMIT 1
    `,
    [referredUserId],
  )
  const referredRow = referredRes.rows[0]
  if (!referredRow) {
    throw new Error('referral_referred_user_not_found')
  }

  const status = computeReferralRelationshipStatus(referredRow, input.policyActive)
  const nowActive = status === 'active'
  const nowInactive = status === 'inactive'

  await systemQuery(
    client,
    `
    INSERT INTO referral_relationships (
      referrer_user_id,
      referred_user_id,
      code,
      status,
      activated_at,
      deactivated_at
    )
    VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN NOW() ELSE NULL END, CASE WHEN $6 THEN NOW() ELSE NULL END)
    `,
    [referrerUserId, referredUserId, code, status, nowActive, nowInactive],
  )
}

/**
 * 가입 시 legacy 추천 코드 적용과 동일한 결과로 관계를 보정한다.
 * - 이미 동일 referrer+code 이면 status 만 재계산(멱등).
 * - 다른 referrer 가 있으면 UPDATE (referred_user_id UNIQUE).
 * - 없으면 createReferralRelationship 재사용.
 *
 * @param {import('pg').PoolClient} client
 * @param {{
 *   referredUserId: string;
 *   referrerUserId: string;
 *   code: string;
 *   policyActive: boolean;
 * }} input
 * @returns {Promise<'noop' | 'created' | 'updated'>}
 */
export async function repairReferralRelationship(client, input) {
  const referredUserId = String(input.referredUserId ?? '').trim()
  const referrerUserId = String(input.referrerUserId ?? '').trim()
  const code = normalizeReferralCode(input.code)

  if (!referredUserId || !referrerUserId || !code) {
    throw new Error('referral_relationship_invalid_input')
  }
  if (referrerUserId === referredUserId) {
    throw new Error('referral_self_not_allowed')
  }

  const existingRes = await systemQuery(
    client,
    `
    SELECT id, referrer_user_id, referred_user_id, code, status
    FROM referral_relationships
    WHERE referred_user_id = $1
    LIMIT 1
    `,
    [referredUserId],
  )
  const existing = existingRes.rows[0]

  const referredRes = await systemQuery(
    client,
    `
    SELECT id, role, status, is_deleted, subscription_plan, subscription_started_at, subscription_expires_at
    FROM users
    WHERE id = $1 AND is_deleted = false
    LIMIT 1
    `,
    [referredUserId],
  )
  const referredRow = referredRes.rows[0]
  if (!referredRow) {
    throw new Error('referral_referred_user_not_found')
  }

  const status = computeReferralRelationshipStatus(referredRow, input.policyActive)
  const nowActive = status === 'active'
  const nowInactive = status === 'inactive'

  if (!existing) {
    await createReferralRelationship(client, {
      referredUserId,
      referrerUserId,
      code,
      policyActive: input.policyActive,
    })
    return 'created'
  }

  const sameReferrer = String(existing.referrer_user_id) === referrerUserId
  const sameCode = normalizeReferralCode(existing.code) === code
  const sameStatus = String(existing.status ?? '').toLowerCase() === status

  if (sameReferrer && sameCode && sameStatus) {
    return 'noop'
  }

  await systemQuery(
    client,
    `
    UPDATE referral_relationships
    SET referrer_user_id = $2,
        code = $3,
        status = $4,
        activated_at = CASE
          WHEN $5 THEN COALESCE(activated_at, NOW())
          ELSE NULL
        END,
        deactivated_at = CASE
          WHEN $6 THEN COALESCE(deactivated_at, NOW())
          ELSE NULL
        END,
        updated_at = NOW()
    WHERE referred_user_id = $1
    `,
    [referredUserId, referrerUserId, code, status, nowActive, nowInactive],
  )
  return 'updated'
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} username
 */
export async function loadUserReferralAuditByUsername(executor, username) {
  const login = String(username ?? '').trim()
  if (!login) {
    return null
  }
  const userRes = await systemQuery(
    executor,
    `
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.role,
      u.status,
      u.ga_id,
      g.name AS ga_name,
      g.code AS ga_code
    FROM users u
    LEFT JOIN ga_companies g ON g.id = u.ga_id
    WHERE LOWER(TRIM(u.username)) = LOWER(TRIM($1))
      AND u.is_deleted = false
    LIMIT 1
    `,
    [login],
  )
  const user = userRes.rows[0]
  if (!user) {
    return null
  }

  const ownCodeRes = await systemQuery(
    executor,
    `SELECT code, created_at FROM referral_codes WHERE owner_user_id = $1 LIMIT 1`,
    [user.id],
  )

  const relRes = await systemQuery(
    executor,
    `
    SELECT
      rr.id,
      rr.referrer_user_id,
      rr.referred_user_id,
      rr.code,
      rr.status,
      rr.created_at,
      rr.activated_at,
      rr.deactivated_at,
      ref_u.username AS referrer_username,
      ref_u.display_name AS referrer_display_name
    FROM referral_relationships rr
    LEFT JOIN users ref_u ON ref_u.id = rr.referrer_user_id AND ref_u.is_deleted = false
    WHERE rr.referred_user_id = $1
    LIMIT 1
    `,
    [user.id],
  )

  const asReferrerRes = await systemQuery(
    executor,
    `
    SELECT
      rr.id,
      rr.referred_user_id,
      u.username AS referred_username,
      u.display_name AS referred_display_name,
      rr.code,
      rr.status,
      rr.created_at
    FROM referral_relationships rr
    INNER JOIN users u ON u.id = rr.referred_user_id AND u.is_deleted = false
    WHERE rr.referrer_user_id = $1
    ORDER BY rr.created_at ASC, rr.id ASC
    `,
    [user.id],
  )

  return {
    user,
    ownReferralCode: ownCodeRes.rows[0] ?? null,
    referredBy: relRes.rows[0] ?? null,
    referredUsers: asReferrerRes.rows,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getReferralSummaryForUser(executor, userId) {
  const uid = String(userId ?? '').trim()
  const policyActive = await readPolicyActive()
  /**
   * 화면·공유용 SSOT 는 username.
   * referral_codes 난수 행은 과거 고객등록/가입 링크 호환용으로만 유지(스키마 VARCHAR(8)).
   */
  await ensureReferralCodeForUser(executor, uid)
  const userRes = await systemQuery(
    executor,
    `SELECT username FROM users WHERE id = $1 AND is_deleted = false LIMIT 1`,
    [uid],
  )
  const referralCode = String(userRes.rows[0]?.username ?? '').trim()

  const listRes = await systemQuery(
    executor,
    `
    SELECT
      rr.id,
      rr.status AS stored_status,
      rr.referred_user_id,
      u.display_name,
      u.role,
      u.status AS user_status,
      u.is_deleted,
      u.subscription_plan,
      u.subscription_started_at,
      u.subscription_expires_at
    FROM referral_relationships rr
    INNER JOIN users u ON u.id = rr.referred_user_id
    WHERE rr.referrer_user_id = $1
    ORDER BY rr.created_at ASC, rr.id ASC
    `,
    [uid],
  )

  const referredUsers = []
  for (const row of listRes.rows) {
    const computed = computeReferralRelationshipStatus(row, policyActive)
    const stored = String(row.stored_status ?? '').toLowerCase()
    if (stored !== computed) {
      const nowActive = computed === 'active'
      const nowInactive = computed === 'inactive'
      await systemQuery(
        executor,
        `
        UPDATE referral_relationships
        SET status = $2,
            activated_at = CASE WHEN $3 THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
            deactivated_at = CASE WHEN $4 THEN COALESCE(deactivated_at, NOW()) ELSE deactivated_at END,
            updated_at = NOW()
        WHERE id = $1
        `,
        [row.id, computed, nowActive, nowInactive],
      )
    }

    const name = String(row.display_name ?? '').trim() || '이름 없음'
    referredUsers.push({
      name,
      status: computed,
      statusLabel: referralStatusLabel(computed),
    })
  }

  return {
    referralCode,
    referredUsers,
  }
}

/**
 * @param {import('pg').Pool} pool
 */
export async function backfillReferralCodesForExistingUsers(pool) {
  const users = await systemQuery(
    pool,
    `
    SELECT u.id
    FROM users u
    LEFT JOIN referral_codes rc ON rc.owner_user_id = u.id
    WHERE u.is_deleted = false AND rc.id IS NULL
    ORDER BY u.created_at ASC
    `,
  )
  for (const row of users.rows) {
    await ensureReferralCodeForUser(pool, String(row.id))
  }
}
