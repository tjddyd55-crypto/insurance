import { normalizeReferralCode } from '../referrals/referralCode.js'
import { createReferralRelationship, validateReferralCodeForSignup } from '../referrals/referralService.js'
import { ensureReferralCodeForUser } from '../referrals/referralCode.js'
import {
  createBillingReferralPending,
  resolveTenantIdForUser,
} from '../insurance-billing/subscriptionLifecycle.js'

/**
 * @typedef {{
 *   referralLegacy?: { referrerUserId: string; code: string } | null;
 *   validationError?: { status: number; message: string };
 * }} SignupCodesPlan
 */

/**
 * @param {Record<string, unknown> | null | undefined} body
 */
function readSignupReferralCodeRaw(body) {
  const b = body ?? {}
  return String(b.referral_code ?? b.referralCode ?? '').trim()
}

/**
 * 추천인 코드만 검증한다. 할인/프로모 코드 사용자 입력은 무료 운영 기간에 사용하지 않는다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {import('express').Request} req
 * @returns {Promise<SignupCodesPlan>}
 */
export async function planSignupCodes(executor, req) {
  const referralNorm = normalizeReferralCode(readSignupReferralCodeRaw(req.body))

  /** @type {SignupCodesPlan} */
  const plan = { referralLegacy: null }

  if (!referralNorm) {
    return plan
  }

  const referral = await validateReferralCodeForSignup(executor, referralNorm)
  if (!referral.ok) {
    plan.validationError = { status: 400, message: referral.message }
    return plan
  }
  if (referral.referrerUserId && referral.code) {
    plan.referralLegacy = { referrerUserId: referral.referrerUserId, code: referral.code }
  }
  return plan
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{
 *   userId: string;
 *   gaId: number | null;
 *   plan: SignupCodesPlan;
 *   policyActive: boolean;
 * }} params
 */
export async function applySignupCodesPlan(client, params) {
  const { userId, gaId, plan, policyActive } = params

  if (!plan.referralLegacy) {
    return
  }

  await createReferralRelationship(client, {
    referredUserId: userId,
    referrerUserId: plan.referralLegacy.referrerUserId,
    code: plan.referralLegacy.code,
    policyActive,
  })
  await ensureReferralCodeForUser(client, plan.referralLegacy.referrerUserId)
  await createBillingReferralPending(client, {
    referrerUserId: plan.referralLegacy.referrerUserId,
    referredUserId: userId,
    referralCode: plan.referralLegacy.code,
    tenantId: await resolveTenantIdForUser(client, userId, gaId),
  })
}
