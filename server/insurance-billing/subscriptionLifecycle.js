import { randomUUID } from 'node:crypto'
import { INSURANCE_BASIC_PLAN_CODE, isInsuranceBillingEnabled } from './config.js'
import { assertUserBillingPromotionNotAlreadyUsed } from './billingPromotionRedemptionPolicy.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { resolveTenantByGaId } from '../lib/crmPlatformMeta.js'
import { assertNoActivePendingInsurancePayment } from './pendingPaymentPolicy.js'
import { resolveNextPeriodEnd, addCalendarMonthsKst as addMonths } from './billingPeriodDate.js'

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
 * @param {object} plan
 * @param {string} billingCycle
 */
export function resolvePlanPaymentAmounts(plan, billingCycle) {
  const cycle = String(billingCycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  const totalAmount =
    cycle === 'yearly'
      ? Number(plan.yearly_total ?? plan.amount ?? 88000)
      : Number(plan.monthly_total ?? plan.amount ?? 8800)
  const supplyAmount =
    cycle === 'yearly'
      ? Number(plan.yearly_price ?? 80000)
      : Number(plan.monthly_price ?? plan.supply_amount ?? 8000)
  const vatAmount = totalAmount - supplyAmount
  return { billingCycle: cycle, totalAmount, supplyAmount, vatAmount }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; billingCycle?: string; planCode?: string; promotionCode?: string | null }} params
 */
export async function createPendingInsurancePayment(client, params) {
  const userId = String(params.userId ?? '').trim()
  const billingCycle = String(params.billingCycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  const planCode = String(params.planCode ?? INSURANCE_BASIC_PLAN_CODE).trim()

  const subR = await systemQuery(
    client,
    `SELECT id, tenant_id, status, plan_code FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  const sub = subR.rows[0]
  if (!sub) {
    throw new Error('subscription_not_found')
  }

  const planR = await systemQuery(
    client,
    `
    SELECT code, monthly_total, yearly_total, monthly_price, yearly_price, is_active
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
  const subscriptionPlanCode = String(sub.plan_code ?? '').trim()
  if (!plan.is_active && subscriptionPlanCode !== planCode) {
    throw new Error('plan_not_found')
  }

  await assertNoActivePendingInsurancePayment(client, userId)

  const { totalAmount, supplyAmount, vatAmount } = resolvePlanPaymentAmounts(plan, billingCycle)

  const refR = await systemQuery(
    client,
    `SELECT referral_code FROM billing_referrals WHERE referred_user_id = $1 LIMIT 1`,
    [userId],
  )
  const referralCode = refR.rows[0]?.referral_code ? String(refR.rows[0].referral_code) : null
  const promotionCode = params.promotionCode ? String(params.promotionCode).trim() : null

  const payIns = await systemQuery(
    client,
    `
    INSERT INTO billing_payments (
      tenant_id, user_id, subscription_id, provider, provider_payment_key, order_id,
      plan_code, billing_cycle, promotion_code, referral_code,
      amount, vat_amount, total_amount, status, created_at, updated_at
    )
    VALUES ($1, $2, $3, 'mock', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW(), NOW())
    RETURNING id
    `,
    [
      sub.tenant_id,
      userId,
      sub.id,
      `mock_req_${randomUUID()}`,
      `onefc_ib_mock_${randomUUID().replace(/-/g, '')}`,
      planCode,
      billingCycle,
      promotionCode,
      referralCode,
      supplyAmount,
      vatAmount,
      totalAmount,
    ],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'payment.request.created',
    payload: {
      paymentId: payIns.rows[0]?.id,
      billingCycle,
      planCode,
      totalAmount,
    },
  })

  return {
    paymentId: Number(payIns.rows[0]?.id),
    status: 'pending',
    subscriptionStatus: sub.status,
    totalAmount,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ paymentId: number | string; adminUserId?: string | null; source?: string }} params
 */
export async function finalizeInsurancePaymentAsPaid(client, params) {
  const paymentId = Number(params.paymentId)
  if (!Number.isFinite(paymentId) || paymentId <= 0) {
    throw new Error('invalid_payment_id')
  }

  const payR = await systemQuery(
    client,
    `
    SELECT *
    FROM billing_payments
    WHERE id = $1
    FOR UPDATE
    `,
    [paymentId],
  )
  const payment = payR.rows[0]
  if (!payment) {
    throw new Error('payment_not_found')
  }
  if (String(payment.status) !== 'pending') {
    throw new Error('payment_not_pending')
  }

  const userId = String(payment.user_id)
  const billingCycle = String(payment.billing_cycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  const planCode = String(payment.plan_code ?? INSURANCE_BASIC_PLAN_CODE).trim()
  const periodStart = params.periodAnchor ? new Date(params.periodAnchor) : new Date()
  if (Number.isNaN(periodStart.getTime())) {
    throw new Error('invalid_period_anchor')
  }
  const periodEnd = resolveNextPeriodEnd(periodStart, billingCycle)

  await systemQuery(
    client,
    `
    UPDATE billing_payments
    SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE id = $1
    `,
    [paymentId],
  )

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET
      status = 'active_paid',
      plan_code = $2,
      billing_cycle = $3,
      pending_billing_cycle = NULL,
      current_period_start = $4,
      current_period_end = $5,
      next_billing_at = $5,
      renewal_retry_count = 0,
      last_renewal_failed_at = NULL,
      next_renewal_retry_at = NULL,
      updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, planCode, billingCycle, periodStart.toISOString(), periodEnd.toISOString()],
  )

  const qualified = await qualifyBillingReferralOnPaidPayment(client, userId)
  let referrerDiscount = null
  if (qualified?.referrer_user_id) {
    referrerDiscount = await recordReferrerDiscountSnapshot(
      client,
      String(qualified.referrer_user_id),
      paymentId,
    )
  }

  const eventType =
    params.source === 'admin'
      ? 'payment.admin.approved'
      : params.source === 'renewal'
        ? 'payment.renewal.completed'
        : params.source === 'toss'
          ? 'payment.toss.completed'
          : 'payment.mock.completed'
  await recordBillingEvent(client, {
    tenantId: payment.tenant_id,
    userId,
    eventType,
    payload: {
      paymentId,
      billingCycle,
      totalAmount: Number(payment.total_amount ?? 0),
      adminUserId: params.adminUserId ?? null,
      referralQualified: Boolean(qualified),
    },
  })

  return {
    paymentId,
    subscriptionStatus: 'active_paid',
    totalAmount: Number(payment.total_amount ?? 0),
    referralQualified: Boolean(qualified),
    referrerDiscount,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number | string} paymentId
 * @param {string} adminUserId
 */
export async function approveInsurancePaymentAdmin(client, paymentId, adminUserId) {
  return finalizeInsurancePaymentAsPaid(client, {
    paymentId,
    adminUserId: String(adminUserId ?? '').trim() || null,
    source: 'admin',
  })
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number | string} paymentId
 * @param {string} adminUserId
 * @param {string | null | undefined} cancelReason
 */
export async function cancelInsurancePaymentAdmin(client, paymentId, adminUserId, cancelReason = null) {
  const id = Number(paymentId)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('invalid_payment_id')
  }

  const payR = await systemQuery(
    client,
    `
    SELECT id, user_id, tenant_id, status
    FROM billing_payments
    WHERE id = $1
    FOR UPDATE
    `,
    [id],
  )
  const payment = payR.rows[0]
  if (!payment) {
    throw new Error('payment_not_found')
  }
  if (String(payment.status) !== 'pending') {
    throw new Error('payment_not_pending')
  }

  const reason = cancelReason ? String(cancelReason).trim() : null

  await systemQuery(
    client,
    `
    UPDATE billing_payments
    SET
      status = 'canceled',
      canceled_at = NOW(),
      cancel_reason = $2,
      updated_at = NOW()
    WHERE id = $1
    `,
    [id, reason],
  )

  await recordBillingEvent(client, {
    tenantId: payment.tenant_id,
    userId: payment.user_id,
    eventType: 'payment.admin.canceled',
    payload: {
      paymentId: id,
      adminUserId: String(adminUserId ?? '').trim() || null,
      cancelReason: reason,
    },
  })

  return {
    paymentId: id,
    status: 'canceled',
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; billingCycle?: string; planCode?: string }} params
 */
export async function completeMockInsurancePayment(client, params) {
  const created = await createPendingInsurancePayment(client, params)
  return finalizeInsurancePaymentAsPaid(client, {
    paymentId: created.paymentId,
    source: 'mock',
  })
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; billingCycle?: string; planCode?: string; promotionCode?: string | null }} params
 */
export async function requestInsurancePayment(client, params) {
  return createPendingInsurancePayment(client, params)
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; promotionRow: object; billingCycle?: string; planCode?: string }} params
 */
export async function applyFreeMonthsPromotion(client, params) {
  const userId = String(params.userId ?? '').trim()
  await assertUserBillingPromotionNotAlreadyUsed(client, userId)

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
