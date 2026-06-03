import {
  MAX_REFERRER_DISCOUNT_COUNT,
  REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT,
  REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL,
} from '../referrals/policy.js'
import {
  BILLING_PLANS,
  calculateDiscountedTotalAmount,
  resolveBillingPlan,
} from '../lib/pricingPolicy.js'
import { readPolicyActive } from '../subscription/appSettings.js'
import { computeReferralRelationshipStatus } from '../referrals/referralStatus.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {boolean} [policyActiveOverride]
 * @returns {Promise<number>}
 */
export async function countActiveReferralsForReferrer(executor, userId, policyActiveOverride) {
  const policyActive =
    typeof policyActiveOverride === 'boolean' ? policyActiveOverride : await readPolicyActive()
  const r = await systemQuery(
    executor,
    `
    SELECT
      u.id,
      u.role,
      u.status,
      u.is_deleted,
      u.subscription_plan,
      u.subscription_started_at,
      u.subscription_expires_at
    FROM referral_relationships rr
    INNER JOIN users u ON u.id = rr.referred_user_id
    WHERE rr.referrer_user_id = $1
    `,
    [userId],
  )
  let count = 0
  for (const row of r.rows) {
    if (computeReferralRelationshipStatus(row, policyActive) === 'active') {
      count += 1
    }
  }
  return count
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function userHasPaidInvoice(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT 1
    FROM payment_invoices
    WHERE user_id = $1 AND status = 'paid'
    LIMIT 1
    `,
    [userId],
  )
  return r.rowCount > 0
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function userWasReferred(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT 1 FROM referral_relationships WHERE referred_user_id = $1 LIMIT 1
    `,
    [userId],
  )
  return r.rowCount > 0
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {{ policyActive?: boolean; planCode?: string }} [options]
 * @returns {Promise<{
 *   planCode: string;
 *   planKey: string;
 *   baseSupplyAmount: number;
 *   baseAmount: number;
 *   vatAmount: number;
 *   referralDiscountAmount: number;
 *   refereeFirstMonthDiscountAmount: number;
 *   discountAmount: number;
 *   finalSupplyAmount: number;
 *   finalAmount: number;
 *   activeReferralCount: number;
 *   appliedReferralCount: number;
 * }>}
 */
export async function calculateInvoicePricing(executor, userId, options = {}) {
  const plan = resolveBillingPlan(options.planCode)

  // TODO: 추천인/GA/관리자 할인 등 자동 plan 선택 조건 확정 후 planCode 결정 로직 연결
  if (plan.key === 'DISCOUNT_MONTHLY') {
    return {
      planCode: plan.dbCode,
      planKey: plan.key,
      baseSupplyAmount: plan.supplyAmount,
      baseAmount: plan.totalAmount,
      vatAmount: plan.vatAmount,
      referralDiscountAmount: 0,
      refereeFirstMonthDiscountAmount: 0,
      discountAmount: 0,
      finalSupplyAmount: plan.supplyAmount,
      finalAmount: plan.totalAmount,
      activeReferralCount: 0,
      appliedReferralCount: 0,
    }
  }

  const baseSupplyAmount = plan.supplyAmount
  const basePriced = calculateDiscountedTotalAmount(baseSupplyAmount, 0)

  const activeReferralCount = await countActiveReferralsForReferrer(
    executor,
    userId,
    options.policyActive,
  )
  const appliedReferralCount = Math.min(activeReferralCount, MAX_REFERRER_DISCOUNT_COUNT)
  const referralDiscountAmount = appliedReferralCount * REFERRER_DISCOUNT_PER_ACTIVE_REFERRAL

  let refereeFirstMonthDiscountAmount = 0
  const hasPaidBefore = await userHasPaidInvoice(executor, userId)
  if (!hasPaidBefore && (await userWasReferred(executor, userId))) {
    refereeFirstMonthDiscountAmount = REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT
  }

  const supplyDiscountAmount = referralDiscountAmount + refereeFirstMonthDiscountAmount
  const finalPriced = calculateDiscountedTotalAmount(baseSupplyAmount, supplyDiscountAmount)

  return {
    planCode: plan.dbCode,
    planKey: plan.key,
    baseSupplyAmount,
    baseAmount: basePriced.totalAmount,
    vatAmount: finalPriced.vatAmount,
    referralDiscountAmount,
    refereeFirstMonthDiscountAmount,
    discountAmount: basePriced.totalAmount - finalPriced.totalAmount,
    finalSupplyAmount: finalPriced.supplyAmount,
    finalAmount: finalPriced.totalAmount,
    activeReferralCount,
    appliedReferralCount,
  }
}

/** @returns {typeof BILLING_PLANS.STANDARD_MONTHLY} */
export function getDefaultBillingPlan() {
  return BILLING_PLANS.STANDARD_MONTHLY
}
