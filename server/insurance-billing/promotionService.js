import { INSURANCE_BASIC_PLAN_CODE } from './config.js'
import { syncSubscriptionTrialExpiry } from './subscriptionLifecycle.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

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
    return { valid: false, message: '유효하지 않은 코드입니다.' }
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
 * @param {{ userId: string; promotionCodeId: number; perUserLimit?: number }} params
 */
export async function assertPromotionPerUserLimit(executor, params) {
  const limit = Math.max(1, Number(params.perUserLimit ?? 1) || 1)
  const r = await systemQuery(
    executor,
    `
    SELECT COUNT(*)::int AS count
    FROM billing_promotion_redemptions
    WHERE user_id = $1 AND promotion_code_id = $2
    `,
    [params.userId, params.promotionCodeId],
  )
  if (Number(r.rows[0]?.count ?? 0) >= limit) {
    throw new Error('promotion_per_user_limit')
  }
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
      await assertPromotionPerUserLimit(executor, {
        userId: params.userId,
        promotionCodeId: Number(row.id),
        perUserLimit: Number(row.per_user_limit ?? 1),
      })
    } catch {
      return { valid: false, code: row.code, message: '이미 사용한 코드입니다.' }
    }
  }

  const planR = await systemQuery(
    executor,
    `
    SELECT monthly_total, yearly_total, monthly_price, yearly_price
    FROM billing_plans WHERE code = $1 AND is_active = true LIMIT 1
    `,
    [planCode],
  )
  const plan = planR.rows[0]
  const baseAmount =
    billingCycle === 'yearly'
      ? Number(plan?.yearly_total ?? 88000)
      : Number(plan?.monthly_total ?? 8800)

  let finalAmount = baseAmount
  let discountAmount = 0
  let freeMonths = null
  const type = String(row.type ?? '').trim()

  if (type === 'free_months') {
    freeMonths = Number(row.free_months ?? 0)
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
    message: base.message,
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
           yearly_price, yearly_vat, yearly_total, currency
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

  return {
    subscriptionStatus: sub?.status ?? 'pending_payment',
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          monthlyPrice: Number(plan.monthly_price ?? 8000),
          monthlyVat: Number(plan.monthly_vat ?? 800),
          monthlyTotal: Number(plan.monthly_total ?? 8800),
          yearlyPrice: Number(plan.yearly_price ?? 80000),
          yearlyVat: Number(plan.yearly_vat ?? 8000),
          yearlyTotal: Number(plan.yearly_total ?? 88000),
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
  }
}
