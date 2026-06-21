import { randomUUID } from 'node:crypto'
import { INSURANCE_BASIC_PLAN_CODE, isInsuranceBillingEnabled } from './config.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { resolveTenantByGaId } from '../lib/crmPlatformMeta.js'

const MS_PER_DAY = 86400000

function addMonths(date, months) {
  const next = new Date(date.getTime())
  next.setMonth(next.getMonth() + months)
  return next
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {number | null | undefined} gaId
 */
export async function resolveTenantIdForUser(executor, userId, gaId) {
  if (gaId != null && Number.isFinite(Number(gaId))) {
    const tenant = await resolveTenantByGaId(executor, Number(gaId))
    if (tenant?.id != null) {
      return Number(tenant.id)
    }
  }
  const r = await systemQuery(
    executor,
    `
    SELECT um.tenant_id
    FROM user_memberships um
    WHERE um.user_id = $1
    ORDER BY um.created_at ASC NULLS LAST, um.id ASC
    LIMIT 1
    `,
    [userId],
  )
  const tenantId = r.rows[0]?.tenant_id
  return tenantId == null ? null : Number(tenantId)
}

/**
 * 신규 가입자 billing_subscriptions bootstrap — pending_payment
 *
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; gaId: number | null }} params
 */
export async function bootstrapInsuranceBillingSubscriptionOnSignup(client, { userId, gaId }) {
  if (!isInsuranceBillingEnabled()) {
    return null
  }
  const existing = await systemQuery(
    client,
    `SELECT id, status FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  if (existing.rowCount > 0) {
    return existing.rows[0]
  }
  const tenantId = await resolveTenantIdForUser(client, userId, gaId)
  const ins = await systemQuery(
    client,
    `
    INSERT INTO billing_subscriptions (
      user_id, tenant_id, plan_code, status, billing_cycle, created_at, updated_at
    )
    VALUES ($1, $2, $3, 'pending_payment', 'monthly', NOW(), NOW())
    RETURNING id, status, plan_code
    `,
    [userId, tenantId, INSURANCE_BASIC_PLAN_CODE],
  )
  await recordBillingEvent(client, {
    tenantId,
    userId,
    eventType: 'subscription.pending_payment.created',
    payload: { planCode: INSURANCE_BASIC_PLAN_CODE },
  })
  return ins.rows[0]
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ referrerUserId: string; referredUserId: string; referralCode: string; tenantId?: number | null }} params
 */
export async function createBillingReferralPending(client, params) {
  const { referrerUserId, referredUserId, referralCode, tenantId = null } = params
  const dup = await systemQuery(
    client,
    `SELECT id FROM billing_referrals WHERE referred_user_id = $1 LIMIT 1`,
    [referredUserId],
  )
  if (dup.rowCount > 0) {
    return dup.rows[0]
  }
  const ins = await systemQuery(
    client,
    `
    INSERT INTO billing_referrals (
      referrer_user_id, referred_user_id, referred_tenant_id, referral_code, status, created_at
    )
    VALUES ($1, $2, $3, $4, 'pending', NOW())
    RETURNING id, status
    `,
    [referrerUserId, referredUserId, tenantId, referralCode],
  )
  await recordBillingEvent(client, {
    tenantId,
    userId: referredUserId,
    eventType: 'referral.pending.created',
    payload: { referrerUserId, referralCode },
  })
  return ins.rows[0]
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function backfillLegacyActiveSubscriptions(executor) {
  const r = await systemQuery(
    executor,
    `
    INSERT INTO billing_subscriptions (user_id, tenant_id, plan_code, status, billing_cycle, created_at, updated_at)
    SELECT
      u.id,
      (
        SELECT um.tenant_id
        FROM user_memberships um
        WHERE um.user_id = u.id
        ORDER BY um.id ASC
        LIMIT 1
      ),
      $1,
      'legacy_active',
      'monthly',
      NOW(),
      NOW()
    FROM users u
    WHERE u.is_deleted = false
      AND u.role = 'USER'
      AND NOT EXISTS (
        SELECT 1 FROM billing_subscriptions bs WHERE bs.user_id = u.id
      )
    RETURNING user_id
    `,
    [INSURANCE_BASIC_PLAN_CODE],
  )
  return r.rowCount ?? 0
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; tenantId?: number | null; eventType: string; payload?: object }} params
 */
export async function recordBillingEvent(client, params) {
  await systemQuery(
    client,
    `
    INSERT INTO billing_events (tenant_id, user_id, event_type, payload_json, created_at)
    VALUES ($1, $2, $3, $4::jsonb, NOW())
    `,
    [
      params.tenantId ?? null,
      params.userId,
      params.eventType,
      JSON.stringify(params.payload ?? {}),
    ],
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getBillingReferralForUser(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT id, referrer_user_id, referral_code, status, created_at, qualified_at
    FROM billing_referrals
    WHERE referred_user_id = $1
    LIMIT 1
    `,
    [userId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} referredUserId
 */
export async function qualifyBillingReferralOnPaidPayment(client, referredUserId) {
  const r = await systemQuery(
    client,
    `
    UPDATE billing_referrals
    SET status = 'active_paid', qualified_at = NOW()
    WHERE referred_user_id = $1
      AND status = 'pending'
    RETURNING id, referrer_user_id
    `,
    [referredUserId],
  )
  return r.rows[0] ?? null
}

/**
 * 추천인 유료 가입자 수 기준 할인 스냅샷 기록 (1차 mock 결제 시 referrer 측)
 *
 * @param {import('pg').PoolClient} client
 * @param {string} referrerUserId
 * @param {number | null | undefined} appliedPaymentId
 */
export async function recordReferrerDiscountSnapshot(client, referrerUserId, appliedPaymentId = null) {
  const count = await countActivePaidReferrals(client, referrerUserId)
  const discountAmount = calculateReferrerDiscountAmount(count)
  const subR = await systemQuery(
    client,
    `SELECT id FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [referrerUserId],
  )
  const subscriptionId = subR.rows[0]?.id ?? null
  const billingPeriod = new Date().toISOString().slice(0, 7)

  await systemQuery(
    client,
    `
    INSERT INTO billing_referral_discounts (
      referrer_user_id, subscription_id, billing_period,
      active_paid_referral_count, discount_amount, applied_payment_id, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
    [referrerUserId, subscriptionId, billingPeriod, count, discountAmount, appliedPaymentId],
  )

  await recordBillingEvent(client, {
    userId: referrerUserId,
    eventType: 'referral.discount.snapshot',
    payload: { activePaidReferralCount: count, discountAmount, billingPeriod },
  })

  return { activePaidReferralCount: count, discountAmount }
}

/**
 * @param {object | null | undefined} subscription
 */
export function isTrialExpiredSubscription(subscription) {
  if (!subscription) {
    return false
  }
  const status = String(subscription.status ?? '').trim().toLowerCase()
  if (status !== 'trialing' && status !== 'trial') {
    return false
  }
  const endsAtRaw = subscription.trial_ends_at ?? subscription.current_period_end
  if (!endsAtRaw) {
    return false
  }
  const endsAt = new Date(endsAtRaw)
  return !Number.isNaN(endsAt.getTime()) && endsAt.getTime() <= Date.now()
}

/**
 * trialing 만료 시 expired 로 전환 (조회 시 lazy sync)
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {object | null | undefined} subscription
 */
export async function syncSubscriptionTrialExpiry(executor, subscription) {
  if (!subscription?.id) {
    return subscription ?? null
  }
  if (!isTrialExpiredSubscription(subscription)) {
    return subscription
  }

  await systemQuery(
    executor,
    `
    UPDATE billing_subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE id = $1
      AND status IN ('trialing', 'trial')
    `,
    [subscription.id],
  )

  await recordBillingEvent(executor, {
    tenantId: subscription.tenant_id ?? null,
    userId: subscription.user_id,
    eventType: 'subscription.trial.expired',
    payload: {
      trialEndsAt: new Date(subscription.trial_ends_at ?? subscription.current_period_end).toISOString(),
    },
  })

  return { ...subscription, status: 'expired' }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} referrerUserId
 */
export async function countActivePaidReferrals(executor, referrerUserId) {
  const r = await systemQuery(
    executor,
    `
    SELECT COUNT(*)::int AS count
    FROM billing_referrals
    WHERE referrer_user_id = $1
      AND status = 'active_paid'
    `,
    [referrerUserId],
  )
  return Number(r.rows[0]?.count ?? 0)
}

/**
 * 추천 할인: active_paid referral 1명당 1,000원, 최대 8,000원
 *
 * @param {number} activePaidReferralCount
 */
export function calculateReferrerDiscountAmount(activePaidReferralCount) {
  const count = Math.max(0, Number(activePaidReferralCount) || 0)
  return Math.min(count * 1000, 8000)
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; billingCycle?: string; planCode?: string }} params
 */
export async function completeMockInsurancePayment(client, params) {
  const userId = String(params.userId ?? '').trim()
  const billingCycle = String(params.billingCycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  const planCode = String(params.planCode ?? INSURANCE_BASIC_PLAN_CODE).trim()

  const planR = await systemQuery(
    client,
    `
    SELECT code, monthly_total, yearly_total, monthly_price, yearly_price
    FROM billing_plans
    WHERE code = $1 AND is_active = true
    LIMIT 1
    `,
    [planCode],
  )
  const plan = planR.rows[0]
  if (!plan) {
    throw new Error('plan_not_found')
  }

  const subR = await systemQuery(
    client,
    `SELECT id, tenant_id, status FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  let sub = subR.rows[0]
  if (!sub) {
    throw new Error('subscription_not_found')
  }

  const totalAmount =
    billingCycle === 'yearly'
      ? Number(plan.yearly_total ?? plan.amount ?? 88000)
      : Number(plan.monthly_total ?? plan.amount ?? 8800)
  const supplyAmount =
    billingCycle === 'yearly'
      ? Number(plan.yearly_price ?? 80000)
      : Number(plan.monthly_price ?? plan.supply_amount ?? 8000)
  const vatAmount = totalAmount - supplyAmount

  const now = new Date()
  const periodEnd =
    billingCycle === 'yearly' ? addMonths(now, 12) : addMonths(now, 1)

  const payIns = await systemQuery(
    client,
    `
    INSERT INTO billing_payments (
      tenant_id, user_id, subscription_id, provider, provider_payment_key,
      amount, vat_amount, total_amount, status, paid_at, created_at, updated_at
    )
    VALUES ($1, $2, $3, 'mock', $4, $5, $6, $7, 'paid', NOW(), NOW(), NOW())
    RETURNING id
    `,
    [
      sub.tenant_id,
      userId,
      sub.id,
      `mock_${randomUUID()}`,
      supplyAmount,
      vatAmount,
      totalAmount,
    ],
  )

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET
      status = 'active_paid',
      plan_code = $2,
      billing_cycle = $3,
      current_period_start = NOW(),
      current_period_end = $4,
      next_billing_at = $4,
      updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, planCode, billingCycle, periodEnd.toISOString()],
  )

  const qualified = await qualifyBillingReferralOnPaidPayment(client, userId)
  let referrerDiscount = null
  if (qualified?.referrer_user_id) {
    referrerDiscount = await recordReferrerDiscountSnapshot(
      client,
      String(qualified.referrer_user_id),
      Number(payIns.rows[0]?.id),
    )
  }

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'payment.mock.completed',
    payload: {
      paymentId: payIns.rows[0]?.id,
      billingCycle,
      totalAmount,
      referralQualified: Boolean(qualified),
    },
  })

  return {
    paymentId: Number(payIns.rows[0]?.id),
    subscriptionStatus: 'active_paid',
    totalAmount,
    referralQualified: Boolean(qualified),
    referrerDiscount,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; promotionRow: object; billingCycle?: string; planCode?: string }} params
 */
export async function applyFreeMonthsPromotion(client, params) {
  const userId = String(params.userId ?? '').trim()
  const promo = params.promotionRow
  const freeMonthsRaw = Number(promo.free_months ?? 0) || 0
  const freeMonths = Math.min(12, Math.max(1, Math.floor(freeMonthsRaw)))
  if (freeMonthsRaw < 1) {
    throw new Error('promotion_free_months_invalid')
  }
  const planCode = String(params.planCode ?? promo.applies_to_plan_code ?? INSURANCE_BASIC_PLAN_CODE).trim()
  const billingCycle = String(params.billingCycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'

  const now = new Date()
  const trialEndsAt = addMonths(now, freeMonths)

  const subR = await systemQuery(
    client,
    `SELECT id, tenant_id FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  let sub = subR.rows[0]
  if (!sub) {
    const tenantId = await resolveTenantIdForUser(client, userId, null)
    const ins = await systemQuery(
      client,
      `
      INSERT INTO billing_subscriptions (user_id, tenant_id, plan_code, status, billing_cycle, created_at, updated_at)
      VALUES ($1, $2, $3, 'pending_payment', $4, NOW(), NOW())
      RETURNING id, tenant_id
      `,
      [userId, tenantId, planCode, billingCycle],
    )
    sub = ins.rows[0]
  }

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET
      status = 'trialing',
      plan_code = $2,
      billing_cycle = $3,
      trial_started_at = NOW(),
      trial_ends_at = $4,
      current_period_start = NOW(),
      current_period_end = $4,
      promotion_code_id = $5,
      updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, planCode, billingCycle, trialEndsAt.toISOString(), promo.id],
  )

  await systemQuery(
    client,
    `
    INSERT INTO billing_promotion_redemptions (
      promotion_code_id, user_id, tenant_id, subscription_id,
      redeemed_at, free_starts_at, free_ends_at, discount_snapshot_json
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW(), $5, $6::jsonb)
    `,
    [
      promo.id,
      userId,
      sub.tenant_id,
      sub.id,
      trialEndsAt.toISOString(),
      JSON.stringify({ type: promo.type, freeMonths, code: promo.code }),
    ],
  )

  await systemQuery(
    client,
    `UPDATE billing_promotion_codes SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1`,
    [promo.id],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'promotion.free_months.applied',
    payload: { code: promo.code, freeMonths, trialEndsAt: trialEndsAt.toISOString() },
  })

  return { status: 'trialing', trialEndsAt: trialEndsAt.toISOString(), freeMonths }
}

export { addMonths }
