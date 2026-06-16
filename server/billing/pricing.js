import {
  REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT,
} from '../referrals/policy.js'
import {
  BILLING_PLANS,
  calculateDiscountedTotalAmount,
  calculateReferralDiscountForPlan,
} from '../lib/pricingPolicy.js'
import { readPolicyActive } from '../subscription/appSettings.js'
import { computeReferralRelationshipStatus } from '../referrals/referralStatus.js'
import { resolveBillingPlanForUser } from './planResolver.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  calculatePromotionDiscountForMonth,
  countPaidInvoices,
  getAppliedPromotionForUser,
} from '../promotions/promotionService.js'

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
 * @param {{ policyActive?: boolean; planCode?: string; resolvedPlan?: Awaited<ReturnType<typeof resolveBillingPlanForUser>> }} [options]
 * @returns {Promise<{
 *   planCode: string;
 *   planKey: string;
 *   planSource: string;
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
  const resolved =
    options.resolvedPlan ??
    (await resolveBillingPlanForUser(executor, userId, { explicitPlanCode: options.planCode }))
  const plan = resolved.plan

  if (!plan.allowsReferralDiscount) {
    return {
      planCode: plan.dbCode,
      planKey: plan.key,
      planSource: resolved.source,
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
  const referralPricing = calculateReferralDiscountForPlan(plan, activeReferralCount)
  const referralDiscountAmount = referralPricing.referralDiscountSupplyAmount
  const appliedReferralCount = referralPricing.appliedReferralCount

  let refereeFirstMonthDiscountAmount = 0
  const hasPaidBefore = await userHasPaidInvoice(executor, userId)
  if (!hasPaidBefore && (await userWasReferred(executor, userId))) {
    refereeFirstMonthDiscountAmount = REFEREE_FIRST_MONTH_DISCOUNT_AMOUNT
  }

  const paidInvoiceCount = await countPaidInvoices(executor, userId)
  const promotionMonthIndex = paidInvoiceCount + 1
  const appliedPromotion = await getAppliedPromotionForUser(executor, userId)
  const now = new Date()
  const promotionEligible =
    appliedPromotion != null &&
    appliedPromotion.isActive === true &&
    (appliedPromotion.startsAt == null || now >= new Date(appliedPromotion.startsAt)) &&
    (appliedPromotion.endsAt == null || now <= new Date(appliedPromotion.endsAt))
  const promotionCalc = promotionEligible
    ? calculatePromotionDiscountForMonth(appliedPromotion, {
        baseSupplyAmount,
        monthIndex: promotionMonthIndex,
      })
    : { promotionDiscountSupplyAmount: 0, applicable: false }
  const promotionDiscountAmount = promotionCalc.promotionDiscountSupplyAmount

  const supplyDiscountAmount = referralDiscountAmount + refereeFirstMonthDiscountAmount + promotionDiscountAmount
  const finalPriced = calculateDiscountedTotalAmount(baseSupplyAmount, supplyDiscountAmount)

  return {
    planCode: plan.dbCode,
    planKey: plan.key,
    planSource: resolved.source,
    baseSupplyAmount,
    baseAmount: basePriced.totalAmount,
    vatAmount: finalPriced.vatAmount,
    referralDiscountAmount,
    refereeFirstMonthDiscountAmount,
    promotionCodeId: promotionEligible ? appliedPromotion.id : null,
    promotionDiscountAmount,
    discountAmount: basePriced.totalAmount - finalPriced.totalAmount,
    finalSupplyAmount: finalPriced.supplyAmount,
    finalAmount: finalPriced.totalAmount,
    activeReferralCount,
    appliedReferralCount,
    promotionMonthIndex,
  }
}

/** @returns {typeof BILLING_PLANS.STANDARD_MONTHLY} */
export function getDefaultBillingPlan() {
  return BILLING_PLANS.STANDARD_MONTHLY
}
