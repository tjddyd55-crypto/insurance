import { INSURANCE_BASIC_PLAN_CODE } from './config.js'
import { enrichBillingManageSummary } from './billingSummaryService.js'
import { syncSubscriptionTrialExpiry } from './subscriptionLifecycle.js'
import {
  assertUserBillingPromotionNotAlreadyUsed,
  PROMOTION_ALREADY_USED_ERROR_CODE,
} from './billingPromotionRedemptionPolicy.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { computeAnnualAmounts, splitVatInclusiveTotal } from '../lib/billingAmounts.js'

/** 월 최종금액(VAT 포함)·VAT 설정에서 월/연간 금액 파생(연간 = 월 × 10). */
function derivePlanCycleAmounts(plan) {
  const monthlyTotal = Math.max(0, Math.round(Number(plan?.monthly_total ?? plan?.amount ?? 8800) || 0))
  const vatOpts = {
    applyVat: plan?.apply_vat !== false,
    vatRate: plan?.vat_rate != null ? Number(plan.vat_rate) : undefined,
  }
  const monthly = splitVatInclusiveTotal(monthlyTotal, vatOpts)
  const annual = computeAnnualAmounts(monthlyTotal, vatOpts)
  return { monthly, annual }
}

function normalizeCode(raw) {
  return String(raw ?? '').trim().toUpperCase()
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ code: string; userId?: string | null }} params
 */
export async function loadPromotionCodeRow(executor, params) {
  const code = normalizeCode(params.code)
  if (!code) {
    return null
  }
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM billing_promotion_codes
    WHERE UPPER(code) = $1
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [code],
  )
  return r.rows[0] ?? null
}

/**
 * @param {object} row
 * @param {{ planCode?: string; billingCycle?: string }} ctx
 */
export function validatePromotionCodeRow(row, ctx = {}) {
  if (!row) {
    return { valid: false, message: '사용할 수 없는 코드입니다.' }
  }
  if (row.deleted_at) {
    return { valid: false, message: '사용할 수 없는 코드입니다.' }
  }
  if (!row.is_active) {
    return { valid: false, message: '사용할 수 없는 코드입니다.' }
  }
  const now = new Date()
  if (row.starts_at && new Date(row.starts_at) > now) {
    return { valid: false, message: '아직 사용할 수 없는 코드입니다.' }
  }
  if (row.ends_at && new Date(row.ends_at) < now) {
    return { valid: false, message: '사용 기간이 만료된 코드입니다.' }
  }
  if (row.max_redemptions != null && Number(row.used_count ?? 0) >= Number(row.max_redemptions)) {
    return { valid: false, message: '사용 횟수가 모두 소진된 코드입니다.' }
  }
  const planCode = String(ctx.planCode ?? INSURANCE_BASIC_PLAN_CODE).trim()
  if (row.applies_to_plan_code && String(row.applies_to_plan_code).trim() !== planCode) {
    return { valid: false, message: '이 요금제에 적용할 수 없는 코드입니다.' }
  }
  if (row.applies_to_product && String(row.applies_to_product).trim() !== 'insurance') {
    return { valid: false, message: '보험 CRM에 적용할 수 없는 코드입니다.' }
  }
  return { valid: true, message: '사용 가능한 코드입니다.' }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ code: string; planCode?: string; billingCycle?: string; userId?: string | null }} params
 */
export async function validateInsurancePromotionCode(executor, params) {
  const planCode = String(params.planCode ?? INSURANCE_BASIC_PLAN_CODE).trim()
  const billingCycle = String(params.billingCycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  const row = await loadPromotionCodeRow(executor, { code: params.code })
  const base = validatePromotionCodeRow(row, { planCode, billingCycle })
  if (!base.valid) {
    return {
      valid: false,
      code: normalizeCode(params.code),
      message: base.message,
    }
  }

  if (params.userId) {
    try {
      await assertUserBillingPromotionNotAlreadyUsed(executor, params.userId, row.id)
    } catch {
      return {
        valid: false,
        code: row.code,
        message: '이미 사용한 쿠폰입니다. 같은 쿠폰은 한 번만 등록할 수 있습니다.',
        errorCode: PROMOTION_ALREADY_USED_ERROR_CODE,
      }
    }
  }

  const planR = await systemQuery(
    executor,
    `
    SELECT monthly_total, yearly_total, monthly_price, yearly_price, amount, apply_vat, vat_rate
    FROM billing_plans WHERE code = $1 AND is_active = true LIMIT 1
    `,
    [planCode],
  )
  const plan = planR.rows[0]
  const derived = derivePlanCycleAmounts(plan)
  const baseAmount = billingCycle === 'yearly' ? derived.annual.annualTotal : derived.monthly.totalAmount

  let finalAmount = baseAmount
  let discountAmount = 0
  let freeMonths = null
  const type = String(row.type ?? '').trim()

  if (type === 'free_months') {
    freeMonths = Number(row.free_months ?? 0)
    if (freeMonths < 1 || freeMonths > 12) {
      return { valid: false, code: row.code, message: '사용할 수 없는 코드입니다.' }
    }
    finalAmount = 0
    discountAmount = baseAmount
  } else if (type === 'percent_off') {
    const pct = Math.min(100, Math.max(0, Number(row.percent_off ?? 0)))
    discountAmount = Math.round((baseAmount * pct) / 100)
    finalAmount = Math.max(0, baseAmount - discountAmount)
  } else if (type === 'amount_off') {
    discountAmount = Math.min(baseAmount, Number(row.amount_off ?? 0))
    finalAmount = Math.max(0, baseAmount - discountAmount)
  } else if (type === 'full_discount') {
    discountAmount = baseAmount
    finalAmount = 0
  }

  return {
    valid: true,
    code: row.code,
    type,
    freeMonths,
    discountAmount,
    finalAmount,
    message:
      type === 'free_months' && freeMonths
        ? `${freeMonths}개월 무료 이용권이 적용 가능합니다.`
        : base.message,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getCheckoutSummary(executor, userId) {
  const subR = await systemQuery(
    executor,
    `
    SELECT id, user_id, tenant_id, status, plan_code, billing_cycle,
           trial_ends_at, current_period_end, next_billing_at
    FROM billing_subscriptions WHERE user_id = $1 LIMIT 1
    `,
    [userId],
  )
  const sub = await syncSubscriptionTrialExpiry(executor, subR.rows[0] ?? null)
  const planCode = String(sub?.plan_code ?? INSURANCE_BASIC_PLAN_CODE)
  const billingCycle = String(sub?.billing_cycle ?? 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly'

  const planR = await systemQuery(
    executor,
    `
    SELECT code, name, monthly_price, monthly_vat, monthly_total,
           yearly_price, yearly_vat, yearly_total, currency, amount, apply_vat, vat_rate
    FROM billing_plans WHERE code = $1 LIMIT 1
    `,
    [planCode],
  )
  const plan = planR.rows[0]

  const refR = await systemQuery(
    executor,
    `SELECT referral_code, status FROM billing_referrals WHERE referred_user_id = $1 LIMIT 1`,
    [userId],
  )
  const referral = refR.rows[0]

  return enrichBillingManageSummary({
    subscriptionStatus: sub?.status ?? 'pending_payment',
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          ...(() => {
            const d = derivePlanCycleAmounts(plan)
            return {
              monthlyPrice: d.monthly.supplyAmount,
              monthlyVat: d.monthly.vatAmount,
              monthlyTotal: d.monthly.totalAmount,
              yearlyPrice: d.annual.supplyAmount,
              yearlyVat: d.annual.vatAmount,
              yearlyTotal: d.annual.annualTotal,
            }
          })(),
          currency: plan.currency ?? 'KRW',
        }
      : null,
    billingCycle,
    trialEndsAt: sub?.trial_ends_at ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    nextBillingAt: sub?.next_billing_at ?? null,
    referral: referral
      ? { code: referral.referral_code, status: referral.status }
      : null,
  })
}
