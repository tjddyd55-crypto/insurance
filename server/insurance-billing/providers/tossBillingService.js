import { randomBytes } from 'node:crypto'
import { resolvePaymentSettingsInternal } from '../../billing/paymentSettingsResolve.js'
import { systemQuery } from '../../utils/dbSafeQuery.js'
import {
  assertBillingCustomerKeyMatch,
  getActiveBillingKeyForUser,
  upsertBillingPaymentCredential,
} from '../billingPaymentCredential.js'
import { assertNoActivePendingInsurancePayment } from '../pendingPaymentPolicy.js'
import {
  finalizeInsurancePaymentAsPaid,
  recordBillingEvent,
  resolvePlanPaymentAmounts,
} from '../subscriptionLifecycle.js'
import { INSURANCE_BASIC_PLAN_CODE, isInsuranceBillingProductionRuntime } from '../config.js'
import { chargeTossBillingKey, issueTossBillingKey } from './toss/tossHttpClient.js'
import { normalizeTossApiFailure } from './toss/tossErrorNormalization.js'

/**
 * @param {number | string} paymentId
 */
export function buildInsuranceBillingOrderId(paymentId) {
  const suffix = randomBytes(4).toString('hex')
  return `onefc_ib_${paymentId}_${suffix}`
}

function resolveTossTestCode(mode, testCode) {
  if (isInsuranceBillingProductionRuntime()) {
    return null
  }
  if (String(mode) !== 'virtual') {
    return null
  }
  const code = String(testCode ?? '').trim()
  return code || null
}

/**
 * @param {import('pg').PoolClient} client
 */
async function loadInsurancePlanForPayment(client, planCode) {
  const r = await systemQuery(
    client,
    `
    SELECT code, monthly_total, yearly_total, monthly_price, yearly_price, is_active, name
    FROM billing_plans
    WHERE code = $1
    LIMIT 1
    `,
    [planCode],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; planCode: string; billingCycle: string; promotionCode?: string | null; provider?: string; paymentSource?: string | null; renewalPeriodKey?: string | null }} params
 */
export async function createPendingInsurancePaymentRow(client, params) {
  const userId = String(params.userId ?? '').trim()
  const billingCycle =
    String(params.billingCycle ?? 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly'
  const planCode = String(params.planCode ?? INSURANCE_BASIC_PLAN_CODE).trim()
  const provider = String(params.provider ?? 'toss').trim()
  const paymentSource = String(params.paymentSource ?? 'checkout').trim() || 'checkout'
  const renewalPeriodKey = params.renewalPeriodKey ? String(params.renewalPeriodKey).trim() : null

  const subR = await systemQuery(
    client,
    `SELECT id, tenant_id, status, plan_code FROM billing_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId],
  )
  const sub = subR.rows[0]
  if (!sub) {
    throw new Error('subscription_not_found')
  }

  const plan = await loadInsurancePlanForPayment(client, planCode)
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
      tenant_id, user_id, subscription_id, provider, provider_payment_key,
      plan_code, billing_cycle, promotion_code, referral_code,
      amount, vat_amount, total_amount, status, payment_source, renewal_period_key,
      created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, NOW(), NOW())
    RETURNING id
    `,
    [
      sub.tenant_id,
      userId,
      sub.id,
      provider,
      planCode,
      billingCycle,
      promotionCode,
      referralCode,
      supplyAmount,
      vatAmount,
      totalAmount,
      paymentSource,
      renewalPeriodKey,
    ],
  )

  const paymentId = Number(payIns.rows[0]?.id)
  const orderId = buildInsuranceBillingOrderId(paymentId)

  await systemQuery(
    client,
    `UPDATE billing_payments SET order_id = $2, updated_at = NOW() WHERE id = $1`,
    [paymentId, orderId],
  )

  await recordBillingEvent(client, {
    tenantId: sub.tenant_id,
    userId,
    eventType: 'payment.request.created',
    payload: {
      paymentId,
      orderId,
      billingCycle,
      planCode,
      totalAmount,
      provider,
    },
  })

  return {
    paymentId,
    orderId,
    status: 'pending',
    subscriptionStatus: sub.status,
    totalAmount,
    planName: String(plan.name ?? planCode),
    billingCycle,
    planCode,
    tenantId: sub.tenant_id,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ paymentId: number; userId: string; billingKey: string; customerKey: string; orderName: string; totalAmount: number; orderId: string; secretKey: string; mode: string; testCode?: string | null }} params
 */
export async function executeTossBillingCharge(client, params) {
  const chargeRes = await chargeTossBillingKey({
    secretKey: params.secretKey,
    billingKey: params.billingKey,
    customerKey: params.customerKey,
    amount: params.totalAmount,
    orderId: params.orderId,
    orderName: params.orderName,
    testCode: resolveTossTestCode(params.mode, params.testCode),
  })

  if (!chargeRes.ok) {
    const normalized = normalizeTossApiFailure(chargeRes)
    await systemQuery(
      client,
      `
      UPDATE billing_payments
      SET
        status = 'failed',
        failed_at = NOW(),
        failure_reason = $2,
        provider_error_code = $3,
        updated_at = NOW()
      WHERE id = $1
      `,
      [params.paymentId, normalized.userMessage, normalized.providerCode],
    )
    await recordBillingEvent(client, {
      userId: params.userId,
      eventType: 'payment.toss.failed',
      payload: {
        paymentId: params.paymentId,
        orderId: params.orderId,
        providerCode: normalized.providerCode,
      },
    })
    const err = new Error(normalized.code)
    err.userMessage = normalized.userMessage
    err.providerCode = normalized.providerCode
    throw err
  }

  const paymentKey = String(chargeRes.json?.paymentKey ?? '').trim()
  if (!paymentKey) {
    throw new Error('toss_payment_key_missing')
  }

  await systemQuery(
    client,
    `
    UPDATE billing_payments
    SET provider_payment_key = $2, updated_at = NOW()
    WHERE id = $1
    `,
    [params.paymentId, paymentKey],
  )

  return finalizeInsurancePaymentAsPaid(client, {
    paymentId: params.paymentId,
    source: params.source === 'renewal' ? 'renewal' : 'toss',
    periodAnchor: params.periodAnchor ?? null,
  })
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; authKey: string; customerKey: string; testCode?: string | null }} params
 */
export async function confirmTossBillingAuth(client, params) {
  const userId = String(params.userId ?? '').trim()
  const authKey = String(params.authKey ?? '').trim()
  const customerKey = String(params.customerKey ?? '').trim()
  if (!authKey || !customerKey) {
    throw new Error('billing_auth_invalid')
  }

  await assertBillingCustomerKeyMatch(client, userId, customerKey)

  const settings = await resolvePaymentSettingsInternal(client)
  if (settings.provider !== 'toss' || !settings.isEnabled) {
    throw new Error('toss_billing_not_enabled')
  }
  if (!settings.hasSecretKey || !settings.secretKey) {
    throw new Error('payment_secret_storage_unavailable')
  }

  const issueRes = await issueTossBillingKey({
    secretKey: settings.secretKey,
    authKey,
    customerKey,
    testCode: resolveTossTestCode(settings.mode, params.testCode),
  })

  if (!issueRes.ok) {
    const normalized = normalizeTossApiFailure(issueRes)
    const err = new Error(normalized.code)
    err.userMessage = normalized.userMessage
    err.providerCode = normalized.providerCode
    throw err
  }

  const billingKey = String(issueRes.json?.billingKey ?? '').trim()
  if (!billingKey) {
    throw new Error('toss_billing_key_missing')
  }

  const card = issueRes.json?.card ?? {}
  await upsertBillingPaymentCredential(client, {
    userId,
    customerKey,
    billingKey,
    cardCompany: card.issuerCode ? String(card.issuerCode) : card.company ?? null,
    cardNumberMasked: card.number ? String(card.number) : null,
    cardType: card.cardType ? String(card.cardType) : null,
  })

  await recordBillingEvent(client, {
    userId,
    eventType: 'billing.credential.registered',
    payload: {
      customerKey,
      cardCompany: card.issuerCode ?? card.company ?? null,
    },
  })

  return {
    ok: true,
    hasBillingKey: true,
    cardCompany: card.issuerCode ?? card.company ?? null,
    cardNumberMasked: card.number ? String(card.number) : null,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; planCode?: string; billingCycle?: string; promotionCode?: string | null; testCode?: string | null; registerOnly?: boolean }} params
 */
export async function requestTossInsurancePayment(client, params) {
  const userId = String(params.userId ?? '').trim()
  const settings = await resolvePaymentSettingsInternal(client)
  if (settings.provider !== 'toss' || !settings.isEnabled) {
    throw new Error('toss_billing_not_enabled')
  }
  if (!settings.hasSecretKey || !settings.secretKey) {
    throw new Error('payment_secret_storage_unavailable')
  }

  const billingCredential = await getActiveBillingKeyForUser(client, userId)
  if (!billingCredential?.billingKey) {
    return {
      needsBillingAuth: true,
      hasBillingKey: false,
    }
  }

  if (params.registerOnly) {
    return {
      needsBillingAuth: false,
      hasBillingKey: true,
      registeredOnly: true,
    }
  }

  const pending = await createPendingInsurancePaymentRow(client, {
    userId,
    planCode: params.planCode,
    billingCycle: params.billingCycle,
    promotionCode: params.promotionCode,
    provider: 'toss',
  })

  const result = await executeTossBillingCharge(client, {
    paymentId: pending.paymentId,
    userId,
    billingKey: billingCredential.billingKey,
    customerKey: billingCredential.customerKey,
    orderName: pending.planName,
    totalAmount: pending.totalAmount,
    orderId: pending.orderId,
    secretKey: settings.secretKey,
    mode: settings.mode,
    testCode: params.testCode,
  })

  return {
    needsBillingAuth: false,
    hasBillingKey: true,
    ...pending,
    ...result,
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string; planCode?: string; billingCycle?: string; testCode?: string | null }} params
 */
export async function completeTossInsurancePayment(client, params) {
  return requestTossInsurancePayment(client, params)
}
