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
  if (!owner) {
    return { ok: false, message: '유효하지 않은 추천인 코드입니다.' }
  }

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
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getReferralSummaryForUser(executor, userId) {
  const uid = String(userId ?? '').trim()
  const policyActive = await readPolicyActive()
  const referralCode = await ensureReferralCodeForUser(executor, uid)

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
