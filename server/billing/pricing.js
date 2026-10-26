import { computeBillingPayment, splitVatInclusiveTotal } from '../lib/billingAmounts.js'
import {
  BILLING_PLANS,
  calculateDiscountedTotalAmount,
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
  const configuredTotal = plan.totalAmount

  // 2026-10 정책: billing_referrals.status='active_paid' 1명당 1,000원, 최종금액 cap, 피추천인 할인 없음.
  const activeReferralCount = await countActivePaidBillingReferrals(executor, userId)
  const referralCalc = computeBillingPayment({ configuredTotal, activeReferralCount })
  const referralDiscountAmount = referralCalc.appliedReferralDiscount
  const appliedReferralCount = activeReferralCount
  const refereeFirstMonthDiscountAmount = 0

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
  // 프로모션 할인(공급가 기준)은 VAT 포함 금액으로 환산해 추천 할인 뒤에 차감
  const promotionDiscountTotal =
    promotionDiscountAmount > 0
      ? configuredTotal - calculateDiscountedTotalAmount(baseSupplyAmount, promotionDiscountAmount).totalAmount
      : 0
  const finalTotal = Math.max(referralCalc.paymentTotal - promotionDiscountTotal, 0)
  const finalPriced = splitVatInclusiveTotal(finalTotal, {
    applyVat: plan.vatRate > 0,
    vatRate: plan.vatRate > 0 ? plan.vatRate : undefined,
  })

  return {
    planCode: plan.dbCode,
    planKey: plan.key,
    planSource: resolved.source,
    baseSupplyAmount,
    baseAmount: configuredTotal,
    vatAmount: finalPriced.vatAmount,
    referralDiscountAmount,
    refereeFirstMonthDiscountAmount,
    promotionCodeId: promotionEligible ? appliedPromotion.id : null,
    promotionDiscountAmount,
    discountAmount: configuredTotal - finalPriced.totalAmount,
    finalSupplyAmount: finalPriced.supplyAmount,
    finalAmount: finalPriced.totalAmount,
    activeReferralCount,
    appliedReferralCount,
    promotionMonthIndex,
  }
}

/**
 * Engine A/B 공통 추천 카운트: billing_referrals.status = 'active_paid'
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function countActivePaidBillingReferrals(executor, userId) {
  const r = await systemQuery(
    executor,
    `SELECT COUNT(*)::int AS c FROM billing_referrals WHERE referrer_user_id = $1 AND status = 'active_paid'`,
    [userId],
  )
  return Number(r.rows[0]?.c ?? 0)
}

/** @returns {typeof BILLING_PLANS.STANDARD_MONTHLY} */
export function getDefaultBillingPlan() {
  return BILLING_PLANS.STANDARD_MONTHLY
}
