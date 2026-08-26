/**
 * 구독 관리 액션 SSOT — 요금제 변경 예약 / 기간말 해지 / 재개.
 * 즉시 추가 과금·환불 없이 next_billing_at 기준으로만 적용.
 */

import { systemQuery } from '../utils/dbSafeQuery.js'
import { getActiveBillingKeyForUser } from './billingPaymentCredential.js'
import { recordBillingEvent, resolvePlanPaymentAmounts } from './subscriptionLifecycle.js'
import { INSURANCE_BASIC_PLAN_CODE } from './config.js'

/**
 * @param {unknown} raw
 * @returns {'monthly' | 'yearly'}
 */
export function normalizeBillingCycle(raw) {
  return String(raw ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
}

/**
 * @param {{ billingCycle?: unknown; pendingBillingCycle?: unknown }} sub
 * @returns {'monthly' | 'yearly'}
 */
export function resolveEffectiveRenewalBillingCycle(sub) {
  const pending = sub?.pendingBillingCycle
  if (pending == null || String(pending).trim() === '') {
    return normalizeBillingCycle(sub?.billingCycle)
  }
  return normalizeBillingCycle(pending)
}

/**
 * @param {{
 *   status?: string | null
 *   cancelAt?: string | Date | null
 *   canceledAt?: string | Date | null
 *   hasBillingCredential?: boolean
 * }} input
 * @returns {'AUTO_RENEW_ACTIVE' | 'CANCEL_SCHEDULED' | 'CANCELED' | 'INACTIVE'}
 */
export function resolveAutoRenewStatus(input) {
  const status = String(input?.status ?? '').trim().toLowerCase()
  if (input?.canceledAt || status === 'canceled' || status === 'cancelled') {
    return 'CANCELED'
  }
  if (input?.cancelAt) {
    return 'CANCEL_SCHEDULED'
  }
  if (status === 'active_paid' && input?.hasBillingCredential) {
    return 'AUTO_RENEW_ACTIVE'
  }
  return 'INACTIVE'
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function assertNoPendingBillingPayment(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT id
    FROM billing_payments
    WHERE user_id = $1 AND status = 'pending'
    LIMIT 1
    `,
    [userId],
  )
  if (r.rows[0]) {
    const err = new Error('billing_change_in_progress')
    throw err
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
async function loadSubscriptionForManage(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      id, user_id, tenant_id, plan_code, status, billing_cycle, pending_billing_cycle,
      current_period_start, current_period_end, next_billing_at,
      cancel_at, canceled_at
    FROM billing_subscriptions
    WHERE user_id = $1
    LIMIT 1
    FOR UPDATE
    `,
    [userId],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; billingCycle: string }} params
 */
export async function schedulePendingBillingCycle(client, params) {
  const userId = String(params.userId ?? '').trim()
  const requested = normalizeBillingCycle(params.billingCycle)
  if (!userId) {
    throw new Error('user_required')
  }

  await assertNoPendingBillingPayment(client, userId)

  const sub = await loadSubscriptionForManage(client, userId)
  if (!sub) {
    throw new Error('subscription_not_found')
  }
  if (String(sub.status).toLowerCase() !== 'active_paid') {
    throw new Error('subscription_not_active_paid')
  }
  if (sub.cancel_at || sub.canceled_at) {
    throw new Error('subscription_cancel_scheduled')
  }

  const current = normalizeBillingCycle(sub.billing_cycle)
  if (requested === current) {
    // same as current → clear any pending and no-op
    if (sub.pending_billing_cycle) {
      await systemQuery(
        client,
        `
        UPDATE billing_subscriptions
        SET pending_billing_cycle = NULL, updated_at = NOW()
        WHERE id = $1
        `,
        [sub.id],
      )
    }
    return {
      ok: true,
      noOp: true,
      billingCycle: current,
      pendingBillingCycle: null,
      nextBillingAt: sub.next_billing_at,
      currentPeriodEnd: sub.current_period_end,
    }
  }

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET pending_billing_cycle = $2, updated_at = NOW()
    WHERE id = $1
    `,
    [sub.id, requested],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'subscription.billing_cycle.pending',
    payload: {
      from: current,
      to: requested,
      nextBillingAt: sub.next_billing_at,
    },
  })

  return {
    ok: true,
    noOp: false,
    billingCycle: current,
    pendingBillingCycle: requested,
    nextBillingAt: sub.next_billing_at,
    currentPeriodEnd: sub.current_period_end,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string }} params
 */
export async function clearPendingBillingCycle(client, params) {
  const userId = String(params.userId ?? '').trim()
  await assertNoPendingBillingPayment(client, userId)
  const sub = await loadSubscriptionForManage(client, userId)
  if (!sub) {
    throw new Error('subscription_not_found')
  }
  if (String(sub.status).toLowerCase() !== 'active_paid') {
    throw new Error('subscription_not_active_paid')
  }
  if (!sub.pending_billing_cycle) {
    return {
      ok: true,
      noOp: true,
      billingCycle: normalizeBillingCycle(sub.billing_cycle),
      pendingBillingCycle: null,
    }
  }

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET pending_billing_cycle = NULL, updated_at = NOW()
    WHERE id = $1
    `,
    [sub.id],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'subscription.billing_cycle.pending_cleared',
    payload: { cleared: String(sub.pending_billing_cycle) },
  })

  return {
    ok: true,
    noOp: false,
    billingCycle: normalizeBillingCycle(sub.billing_cycle),
    pendingBillingCycle: null,
  }
}

/**
 * 기간말 해지 예약. cancel_at = current_period_end (없으면 next_billing_at).
 * pending cycle 은 함께 clear.
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string }} params
 */
export async function scheduleCancelAtPeriodEnd(client, params) {
  const userId = String(params.userId ?? '').trim()
  await assertNoPendingBillingPayment(client, userId)
  const sub = await loadSubscriptionForManage(client, userId)
  if (!sub) {
    throw new Error('subscription_not_found')
  }
  if (String(sub.status).toLowerCase() !== 'active_paid') {
    throw new Error('subscription_not_active_paid')
  }
  if (sub.canceled_at) {
    throw new Error('subscription_already_canceled')
  }

  const cancelAt = sub.current_period_end ?? sub.next_billing_at
  if (!cancelAt) {
    throw new Error('period_end_missing')
  }

  if (sub.cancel_at) {
    return {
      ok: true,
      noOp: true,
      cancelAt: sub.cancel_at,
      currentPeriodEnd: sub.current_period_end,
      pendingBillingCycle: sub.pending_billing_cycle
        ? normalizeBillingCycle(sub.pending_billing_cycle)
        : null,
    }
  }

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET
      cancel_at = $2,
      pending_billing_cycle = NULL,
      updated_at = NOW()
    WHERE id = $1
    `,
    [sub.id, cancelAt],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'subscription.cancel_at_period_end',
    payload: { cancelAt },
  })

  return {
    ok: true,
    noOp: false,
    cancelAt,
    currentPeriodEnd: sub.current_period_end,
    pendingBillingCycle: null,
  }
}

/**
 * 해지 예약 취소 (기간 종료 전). credential 없으면 resume_requires_card.
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string }} params
 */
export async function resumeAutoRenew(client, params) {
  const userId = String(params.userId ?? '').trim()
  await assertNoPendingBillingPayment(client, userId)
  const sub = await loadSubscriptionForManage(client, userId)
  if (!sub) {
    throw new Error('subscription_not_found')
  }
  if (String(sub.status).toLowerCase() !== 'active_paid') {
    throw new Error('subscription_not_active_paid')
  }
  if (sub.canceled_at) {
    throw new Error('subscription_already_canceled')
  }
  if (!sub.cancel_at) {
    return { ok: true, noOp: true, cancelAt: null, requiresCard: false }
  }

  let hasCredential = false
  try {
    const cred = await getActiveBillingKeyForUser(client, userId)
    hasCredential = Boolean(cred?.billingKey)
  } catch {
    hasCredential = false
  }
  if (!hasCredential) {
    const err = new Error('resume_requires_card')
    throw err
  }

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET cancel_at = NULL, updated_at = NOW()
    WHERE id = $1
    `,
    [sub.id],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'subscription.auto_renew.resumed',
    payload: {},
  })

  return { ok: true, noOp: false, cancelAt: null, requiresCard: false }
}

/**
 * @param {object | null | undefined} planRow
 * @param {'monthly' | 'yearly'} cycle
 */
export function resolveNextChargeAmountFromPlan(planRow, cycle) {
  const amounts = resolvePlanPaymentAmounts(
    planRow ?? {
      monthly_total: 8800,
      yearly_total: 88000,
      monthly_price: 8000,
      yearly_price: 80000,
    },
    cycle,
  )
  return amounts
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} planCode
 */
export async function loadBillingPlanAmounts(executor, planCode) {
  const code = String(planCode ?? INSURANCE_BASIC_PLAN_CODE).trim() || INSURANCE_BASIC_PLAN_CODE
  const r = await systemQuery(
    executor,
    `
    SELECT code, name, monthly_price, monthly_vat, monthly_total, yearly_price, yearly_vat, yearly_total
    FROM billing_plans
    WHERE code = $1
    LIMIT 1
    `,
    [code],
  )
  return r.rows[0] ?? null
}
