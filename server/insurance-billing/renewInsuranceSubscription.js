/**
 * 구독 자동갱신 실행 SSOT.
 * worker / QA script 가 동일 함수를 호출한다.
 */

import { systemQuery } from '../utils/dbSafeQuery.js'
import { isStoreReviewBillingSubject } from '../lib/storeReviewIdentity.js'
import { resolvePaymentSettingsInternal } from '../billing/paymentSettingsResolve.js'
import { getActiveBillingKeyForUser } from './billingPaymentCredential.js'
import { recordBillingEvent } from './subscriptionLifecycle.js'
import { getInsuranceBillingProvider } from './config.js'
import {
  createPendingInsurancePaymentRow,
  executeTossBillingCharge,
} from './providers/tossBillingService.js'
import { buildRenewalPeriodKey } from './billingPeriodDate.js'
import { addCalendarDaysKst } from './billingPeriodDate.js'
import {
  classifyRenewalTossError,
  evaluateRenewalEligibility,
  getInsuranceBillingRenewalMaxRetry,
  getInsuranceBillingRenewalRetryDelayDays,
} from './renewalPolicy.js'

function isUniqueViolation(error) {
  return String(error?.code ?? '') === '23505'
}

/**
 * @param {object} row
 */
export function mapDueSubscriptionRow(row) {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    tenantId: row.tenant_id == null ? null : Number(row.tenant_id),
    status: String(row.status ?? ''),
    planCode: String(row.plan_code ?? ''),
    billingCycle: String(row.billing_cycle ?? 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly',
    nextBillingAt: row.next_billing_at,
    cancelAt: row.cancel_at,
    canceledAt: row.canceled_at,
    retryCount: Number(row.renewal_retry_count ?? 0),
    nextRetryAt: row.next_renewal_retry_at,
    gaCode: row.ga_code ?? null,
    username: row.username ?? null,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ now?: Date; limit?: number }} params
 */
export async function listDueInsuranceRenewals(client, params = {}) {
  const now = params.now ?? new Date()
  const limit = Math.max(1, Math.min(500, Number(params.limit ?? 50)))
  const maxRetry = getInsuranceBillingRenewalMaxRetry()
  const r = await systemQuery(
    client,
    `
    SELECT
      bs.id, bs.user_id, bs.tenant_id, bs.status, bs.plan_code, bs.billing_cycle,
      bs.next_billing_at, bs.cancel_at, bs.canceled_at,
      bs.renewal_retry_count, bs.next_renewal_retry_at,
      gc.code AS ga_code,
      u.username
    FROM billing_subscriptions bs
    JOIN users u ON u.id = bs.user_id
    LEFT JOIN ga_companies gc ON gc.id = u.ga_id
    WHERE bs.status = 'active_paid'
      AND bs.next_billing_at IS NOT NULL
      AND bs.canceled_at IS NULL
      AND bs.cancel_at IS NULL
      AND COALESCE(bs.renewal_retry_count, 0) < $2
      AND (
        (COALESCE(bs.renewal_retry_count, 0) = 0 AND bs.next_billing_at <= $1)
        OR (
          COALESCE(bs.renewal_retry_count, 0) > 0
          AND bs.next_renewal_retry_at IS NOT NULL
          AND bs.next_renewal_retry_at <= $1
        )
      )
      AND EXISTS (
        SELECT 1
        FROM billing_payment_credentials c
        WHERE c.user_id = bs.user_id
          AND c.status = 'active'
          AND c.billing_key_ciphertext IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM billing_payments p
        WHERE p.user_id = bs.user_id AND p.status = 'pending'
      )
    ORDER BY bs.next_billing_at ASC, bs.id ASC
    LIMIT $3
    FOR UPDATE OF bs SKIP LOCKED
    `,
    [now.toISOString(), maxRetry, limit],
  )
  return r.rows.map(mapDueSubscriptionRow)
}

/**
 * dry-run 용 — row lock 없음.
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function listDueInsuranceRenewalsDryRun(executor, params = {}) {
  const now = params.now ?? new Date()
  const limit = Math.max(1, Math.min(500, Number(params.limit ?? 50)))
  const maxRetry = getInsuranceBillingRenewalMaxRetry()
  const r = await systemQuery(
    executor,
    `
    SELECT
      bs.id, bs.user_id, bs.tenant_id, bs.status, bs.plan_code, bs.billing_cycle,
      bs.next_billing_at, bs.cancel_at, bs.canceled_at,
      bs.renewal_retry_count, bs.next_renewal_retry_at,
      gc.code AS ga_code,
      u.username
    FROM billing_subscriptions bs
    JOIN users u ON u.id = bs.user_id
    LEFT JOIN ga_companies gc ON gc.id = u.ga_id
    WHERE bs.status = 'active_paid'
      AND bs.next_billing_at IS NOT NULL
      AND bs.canceled_at IS NULL
      AND bs.cancel_at IS NULL
      AND COALESCE(bs.renewal_retry_count, 0) < $2
      AND (
        (COALESCE(bs.renewal_retry_count, 0) = 0 AND bs.next_billing_at <= $1)
        OR (
          COALESCE(bs.renewal_retry_count, 0) > 0
          AND bs.next_renewal_retry_at IS NOT NULL
          AND bs.next_renewal_retry_at <= $1
        )
      )
      AND EXISTS (
        SELECT 1
        FROM billing_payment_credentials c
        WHERE c.user_id = bs.user_id
          AND c.status = 'active'
          AND c.billing_key_ciphertext IS NOT NULL
      )
    ORDER BY bs.next_billing_at ASC, bs.id ASC
    LIMIT $3
    `,
    [now.toISOString(), maxRetry, limit],
  )
  return r.rows.map(mapDueSubscriptionRow)
}

async function markRenewalFailure(client, sub, errorClass, providerCode) {
  const nextCount = Number(sub.retryCount ?? 0) + 1
  const maxRetry = getInsuranceBillingRenewalMaxRetry()
  const delays = getInsuranceBillingRenewalRetryDelayDays()
  const delayDays = delays[Math.min(nextCount - 1, delays.length - 1)] ?? 1
  const nextRetryAt = addCalendarDaysKst(sub.nextBillingAt, delayDays)
  const terminal = nextCount >= maxRetry || errorClass === 'terminal'
  const nextStatus = terminal && nextCount >= maxRetry ? 'past_due' : 'active_paid'

  await systemQuery(
    client,
    `
    UPDATE billing_subscriptions
    SET
      status = $2,
      renewal_retry_count = $3,
      last_renewal_failed_at = NOW(),
      next_renewal_retry_at = $4,
      updated_at = NOW()
    WHERE id = $1
    `,
    [sub.id, nextStatus, nextCount, nextRetryAt.toISOString()],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenantId,
    userId: sub.userId,
    eventType: 'payment.renewal.failed',
    payload: {
      subscriptionId: sub.id,
      retryCount: nextCount,
      providerCode: providerCode ?? null,
      nextStatus,
    },
  })

  return { retryCount: nextCount, nextRetryAt: nextRetryAt.toISOString(), status: nextStatus }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ subscriptionId: number; now?: Date; testCode?: string | null }} params
 */
export async function renewInsuranceSubscription(client, params) {
  const now = params.now ?? new Date()
  const subR = await systemQuery(
    client,
    `
    SELECT
      bs.id, bs.user_id, bs.tenant_id, bs.status, bs.plan_code, bs.billing_cycle,
      bs.next_billing_at, bs.cancel_at, bs.canceled_at,
      bs.renewal_retry_count, bs.next_renewal_retry_at,
      gc.code AS ga_code,
      u.username
    FROM billing_subscriptions bs
    JOIN users u ON u.id = bs.user_id
    LEFT JOIN ga_companies gc ON gc.id = u.ga_id
    WHERE bs.id = $1
    LIMIT 1
    FOR UPDATE OF bs SKIP LOCKED
    `,
    [params.subscriptionId],
  )
  const sub = subR.rows[0] ? mapDueSubscriptionRow(subR.rows[0]) : null
  if (!sub) {
    return { outcome: 'skipped', reason: 'subscription_not_found' }
  }

  let hasBillingCredential = false
  try {
    const cred = await getActiveBillingKeyForUser(client, sub.userId)
    hasBillingCredential = Boolean(cred?.billingKey)
  } catch {
    return { outcome: 'skipped', reason: 'billing_credential_invalid' }
  }

  const eligibility = evaluateRenewalEligibility({
    status: sub.status,
    nextBillingAt: sub.nextBillingAt,
    retryCount: sub.retryCount,
    nextRetryAt: sub.nextRetryAt,
    cancelAt: sub.cancelAt,
    canceledAt: sub.canceledAt,
    hasBillingCredential,
    isReviewAccount: isStoreReviewBillingSubject({ gaCode: sub.gaCode, username: sub.username }),
    workerProvider: getInsuranceBillingProvider(),
    now,
    maxRetry: getInsuranceBillingRenewalMaxRetry(),
  })
  if (!eligibility.ok) {
    return { outcome: 'skipped', reason: eligibility.reason }
  }

  const settings = await resolvePaymentSettingsInternal(client)
  if (settings.provider !== 'toss' || !settings.isEnabled || !settings.secretKey) {
    return { outcome: 'skipped', reason: 'toss_billing_not_enabled' }
  }

  const billingCredential = await getActiveBillingKeyForUser(client, sub.userId)
  if (!billingCredential?.billingKey) {
    return { outcome: 'skipped', reason: 'billing_credential_missing' }
  }

  const periodKey = buildRenewalPeriodKey(sub.nextBillingAt)

  let pending
  try {
    pending = await createPendingInsurancePaymentRow(client, {
      userId: sub.userId,
      planCode: sub.planCode,
      billingCycle: sub.billingCycle,
      provider: 'toss',
      paymentSource: 'renewal',
      renewalPeriodKey: periodKey,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { outcome: 'skipped', reason: 'already_renewed_or_pending' }
    }
    throw error
  }

  try {
    const paid = await executeTossBillingCharge(client, {
      paymentId: pending.paymentId,
      userId: sub.userId,
      billingKey: billingCredential.billingKey,
      customerKey: billingCredential.customerKey,
      orderName: pending.planName,
      totalAmount: pending.totalAmount,
      orderId: pending.orderId,
      secretKey: settings.secretKey,
      mode: settings.mode,
      testCode: params.testCode ?? null,
      source: 'renewal',
      periodAnchor: sub.nextBillingAt,
    })
    return {
      outcome: 'paid',
      reason: 'renewed',
      paymentId: pending.paymentId,
      totalAmount: pending.totalAmount,
      subscriptionStatus: paid.subscriptionStatus,
      renewalPeriodKey: periodKey,
    }
  } catch (error) {
    const providerCode = error?.providerCode ?? null
    const errorClass = classifyRenewalTossError(providerCode)
    if (errorClass === 'already_processed') {
      return { outcome: 'skipped', reason: 'already_processed', paymentId: pending.paymentId }
    }
    const failure = await markRenewalFailure(client, sub, errorClass, providerCode)
    return {
      outcome: 'failed',
      reason: error?.message ?? 'renewal_charge_failed',
      paymentId: pending.paymentId,
      providerCode,
      errorClass,
      ...failure,
    }
  }
}
