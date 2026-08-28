/**
 * Checkout quote SSOT — 화면 표시 금액과 Toss 청구액을 같은 계산으로 맞춤.
 * 쿠폰 엔진(validateInsurancePromotionCode) 재사용. 신규 coupon system 금지.
 */

import { INSURANCE_BASIC_PLAN_CODE } from './config.js'
import { resolveNextPeriodEnd } from './billingPeriodDate.js'
import { resolvePlanPaymentAmounts } from './subscriptionLifecycle.js'
import { validateInsurancePromotionCode } from './promotionService.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * 할인 후 총액 → 공급가/VAT 분해 (VAT 포함 총액 기준, 10% 가정).
 * @param {number} totalAmount
 */
export function splitInclusiveTotalAmount(totalAmount) {
  const total = Math.max(0, Math.round(Number(totalAmount) || 0))
  if (total === 0) {
    return { totalAmount: 0, supplyAmount: 0, vatAmount: 0 }
  }
  const supplyAmount = Math.round(total / 1.1)
  const vatAmount = total - supplyAmount
  return { totalAmount: total, supplyAmount, vatAmount }
}

/**
 * @param {object | null | undefined} plan
 * @param {'monthly' | 'yearly'} billingCycle
 * @param {{ discountAmount?: number; finalAmount?: number } | null} promo
 */
export function resolveCheckoutChargeAmounts(plan, billingCycle, promo = null) {
  const base = resolvePlanPaymentAmounts(
    plan ?? {
      monthly_total: 8800,
      yearly_total: 88000,
      monthly_price: 8000,
      yearly_price: 80000,
    },
    billingCycle,
  )
  const discountAmount = Math.max(0, Math.min(base.totalAmount, Math.round(Number(promo?.discountAmount ?? 0) || 0)))
  const finalFromPromo =
    promo?.finalAmount != null && Number.isFinite(Number(promo.finalAmount))
      ? Math.max(0, Math.round(Number(promo.finalAmount)))
      : base.totalAmount - discountAmount
  const finalAmount = Math.max(0, Math.min(base.totalAmount, finalFromPromo))
  const split = splitInclusiveTotalAmount(finalAmount)
  return {
    baseAmount: base.totalAmount,
    baseSupplyAmount: base.supplyAmount,
    baseVatAmount: base.vatAmount,
    discountAmount: base.totalAmount - finalAmount,
    ...split,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   userId: string
 *   billingCycle?: string
 *   planCode?: string
 *   promotionCode?: string | null
 * }} params
 */
export async function buildCheckoutQuote(executor, params) {
  const userId = String(params.userId ?? '').trim()
  const planCode = String(params.planCode ?? INSURANCE_BASIC_PLAN_CODE).trim() || INSURANCE_BASIC_PLAN_CODE
  const billingCycle =
    String(params.billingCycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  const promotionCodeRaw = String(params.promotionCode ?? '').trim()

  const planR = await systemQuery(
    executor,
    `
    SELECT code, name, monthly_price, monthly_vat, monthly_total,
           yearly_price, yearly_vat, yearly_total, currency, is_active
    FROM billing_plans
    WHERE code = $1
    LIMIT 1
    `,
    [planCode],
  )
  const plan = planR.rows[0]
  if (!plan) {
    throw new Error('plan_not_found')
  }

  let coupon = null
  let promoValidate = null
  if (promotionCodeRaw) {
    promoValidate = await validateInsurancePromotionCode(executor, {
      code: promotionCodeRaw,
      planCode,
      billingCycle,
      userId,
    })
    if (!promoValidate.valid) {
      return {
        valid: false,
        planCode,
        planName: String(plan.name ?? planCode),
        billingCycle,
        baseAmount: resolvePlanPaymentAmounts(plan, billingCycle).totalAmount,
        discountAmount: 0,
        todayChargeAmount: resolvePlanPaymentAmounts(plan, billingCycle).totalAmount,
        nextChargeAmount: resolvePlanPaymentAmounts(plan, billingCycle).totalAmount,
        nextBillingAt: resolveNextPeriodEnd(new Date(), billingCycle).toISOString(),
        coupon: null,
        message: promoValidate.message ?? '사용할 수 없는 쿠폰입니다.',
        errorCode: promoValidate.errorCode ?? 'promotion_invalid',
        summaryMessage: promoValidate.message ?? '사용할 수 없는 쿠폰입니다.',
        benefitKind: null,
      }
    }
    coupon = {
      code: promoValidate.code,
      type: promoValidate.type,
      freeMonths: promoValidate.freeMonths ?? null,
      discountAmount: Number(promoValidate.discountAmount ?? 0),
      finalAmount: Number(promoValidate.finalAmount ?? 0),
      message: promoValidate.message ?? null,
    }
  }

  const amounts = resolveCheckoutChargeAmounts(plan, billingCycle, coupon)
  const type = coupon?.type ? String(coupon.type) : null
  const isFreeMonths = type === 'free_months'
  const now = new Date()
  let nextBillingAt = resolveNextPeriodEnd(now, billingCycle).toISOString()
  let nextChargeAmount = resolvePlanPaymentAmounts(plan, billingCycle).totalAmount
  let todayChargeAmount = amounts.totalAmount
  let benefitKind = 'none'
  let summaryMessage = ''

  if (isFreeMonths && coupon?.freeMonths) {
    benefitKind = 'free_months'
    todayChargeAmount = 0
    const trialEnd = new Date(now)
    trialEnd.setMonth(trialEnd.getMonth() + Number(coupon.freeMonths))
    nextBillingAt = trialEnd.toISOString()
    nextChargeAmount = resolvePlanPaymentAmounts(plan, billingCycle).totalAmount
    summaryMessage = `오늘 결제는 없고 ${coupon.freeMonths}개월 무료 이용 후 ${nextChargeAmount.toLocaleString('ko-KR')}원이 자동결제됩니다.`
  } else if (amounts.discountAmount > 0) {
    benefitKind = type === 'percent_off' ? 'percent_off' : 'amount_off'
    summaryMessage =
      todayChargeAmount === 0
        ? '오늘 결제금액은 0원입니다. 다음 결제일부터 정상 요금이 자동결제됩니다.'
        : `오늘 ${todayChargeAmount.toLocaleString('ko-KR')}원이 결제되고 다음 결제일부터 ${nextChargeAmount.toLocaleString('ko-KR')}원이 자동결제됩니다.`
  } else {
    summaryMessage = `오늘 ${todayChargeAmount.toLocaleString('ko-KR')}원이 결제되고 다음 결제일부터 매월(또는 매년) 자동결제됩니다.`
  }

  return {
    valid: true,
    planCode,
    planName: String(plan.name ?? planCode),
    billingCycle,
    baseAmount: amounts.baseAmount,
    baseSupplyAmount: amounts.baseSupplyAmount,
    baseVatAmount: amounts.baseVatAmount,
    discountAmount: isFreeMonths ? amounts.baseAmount : amounts.discountAmount,
    todayChargeAmount,
    todaySupplyAmount: isFreeMonths ? 0 : amounts.supplyAmount,
    todayVatAmount: isFreeMonths ? 0 : amounts.vatAmount,
    nextChargeAmount,
    nextBillingAt,
    coupon,
    message: coupon?.message ?? null,
    errorCode: null,
    summaryMessage,
    benefitKind,
  }
}
