import { randomBytes } from 'node:crypto'
import { resolvePaymentSettingsInternal } from '../../billing/paymentSettingsResolve.js'
import { systemQuery } from '../../utils/dbSafeQuery.js'
import {
  assertBillingCredentialModeMatch,
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
import { resolveCheckoutChargeAmounts } from '../checkoutQuoteService.js'
import { validateInsurancePromotionCode } from '../promotionService.js'
import { validateTossPaymentAgainstExpected } from './toss/tossPaymentValidation.js'
import { finalizeReconciledTossPayment, reconcilePendingInsurancePayment } from '../reconcileInsurancePayment.js'

import { withShortBillingTransaction } from '../billingTransaction.js'
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

  let totalAmount
  let supplyAmount
  let vatAmount
  let discountAmount = 0
  const promotionCode = params.promotionCode ? String(params.promotionCode).trim() : null

  if (paymentSource === 'renewal' || !promotionCode) {
    const amounts = resolvePlanPaymentAmounts(plan, billingCycle)
    totalAmount = amounts.totalAmount
    supplyAmount = amounts.supplyAmount
    vatAmount = amounts.vatAmount
  } else {
    const validated = await validateInsurancePromotionCode(client, {
      code: promotionCode,
      planCode,
      billingCycle,
      userId,
    })
    if (!validated.valid) {
      throw new Error('promotion_invalid')
    }
    if (validated.type === 'free_months') {
      throw new Error('promotion_requires_apply_path')
    }
    const amounts = resolveCheckoutChargeAmounts(plan, billingCycle, {
      discountAmount: validated.discountAmount,
      finalAmount: validated.finalAmount,
    })
    totalAmount = amounts.totalAmount
    supplyAmount = amounts.supplyAmount
    vatAmount = amounts.vatAmount
    discountAmount = amounts.discountAmount
  }

  const refR = await systemQuery(
    client,
    `SELECT referral_code FROM billing_referrals WHERE referred_user_id = $1 LIMIT 1`,
    [userId],
  )
  const referralCode = refR.rows[0]?.referral_code ? String(refR.rows[0].referral_code) : null

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
      discountAmount,
      provider,
      promotionCode,
    },
  })

  return {
    paymentId,
    orderId,
    status: 'pending',
    subscriptionStatus: sub.status,
    totalAmount,
    discountAmount,
    planName: String(plan.name ?? planCode),
    billingCycle,
    planCode,
    tenantId: sub.tenant_id,
    promotionCode,
  }
}

/**
 * DB transaction 밖 Toss billing charge network call.
 * @param {{ secretKey: string; billingKey: string; customerKey: string; amount: number; orderId: string; orderName: string; mode: string; testCode?: string | null }} params
 */
export async function performTossBillingChargeNetwork(params) {
  return chargeTossBillingKey({
    secretKey: params.secretKey,
    billingKey: params.billingKey,
    customerKey: params.customerKey,
    amount: params.amount,
    orderId: params.orderId,
    orderName: params.orderName,
    testCode: resolveTossTestCode(params.mode, params.testCode),
  })
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ chargeRes: { ok: boolean; status: number; json: unknown }; paymentId: number; userId: string; orderId: string; totalAmount: number; source?: string; periodAnchor?: Date | string | null; secretKey?: string }} params
 */
export async function applyTossBillingChargeResult(client, params) {
  const { chargeRes, paymentId, userId, orderId, totalAmount } = params
  const source = params.source === 'renewal' ? 'renewal' : 'toss'

  if (!chargeRes.ok) {
    const normalized = normalizeTossApiFailure(chargeRes)
    if (normalized.providerCode === 'ALREADY_PROCESSED_PAYMENT') {
      const reconciled = await reconcilePendingInsurancePayment(client, {
        paymentId,
        secretKey: params.secretKey ?? null,
        source,
        periodAnchor: params.periodAnchor ?? null,
      })
      if (reconciled.outcome === 'reconciled' || reconciled.outcome === 'already_paid') {
        return reconciled
      }
      return finalizeInsurancePaymentAsPaid(client, {
        paymentId,
        source,
        periodAnchor: params.periodAnchor ?? null,
      })
    }

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
        AND status = 'pending'
      `,
      [paymentId, normalized.userMessage, normalized.providerCode],
    )
    await recordBillingEvent(client, {
      userId,
      eventType: 'payment.toss.failed',
      payload: {
        paymentId,
        orderId,
        providerCode: normalized.providerCode,
      },
    })
    const err = new Error(normalized.code)
    err.userMessage = normalized.userMessage
    err.providerCode = normalized.providerCode
    throw err
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

  const validated = validateTossPaymentAgainstExpected(chargeRes.json, {
    orderId,
    totalAmount,
  })
  if (!validated.ok) {
    console.warn('[billing/toss] amount/order validation failed', {
      paymentId,
      orderId,
      reason: validated.reason,
      expectedAmount: totalAmount,
      providerAmount: validated.providerAmount ?? null,
    })
    const err = new Error(`toss_payment_${validated.reason}`)
    err.validation = validated
    throw err
  }

  return finalizeReconciledTossPayment(client, {
    payment,
    tossPayment: chargeRes.json,
    source,
    periodAnchor: params.periodAnchor ?? null,
  })
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ paymentId: number; userId: string; billingKey: string; customerKey: string; orderName: string; totalAmount: number; orderId: string; secretKey: string; mode: string; testCode?: string | null; source?: string; periodAnchor?: Date | string | null }} params
 */
export async function runTossBillingChargeOutsideTransaction(pool, params) {
  let chargeRes
  try {
    chargeRes = await performTossBillingChargeNetwork({
      secretKey: params.secretKey,
      billingKey: params.billingKey,
      customerKey: params.customerKey,
      amount: params.totalAmount,
      orderId: params.orderId,
      orderName: params.orderName,
      mode: params.mode,
      testCode: params.testCode ?? null,
    })
  } catch (networkError) {
    const reconciled = await reconcilePendingInsurancePayment(pool, {
      paymentId: params.paymentId,
      secretKey: params.secretKey,
      source: params.source === 'renewal' ? 'renewal' : 'toss',
      periodAnchor: params.periodAnchor ?? null,
    })
    if (reconciled.outcome === 'reconciled' || reconciled.outcome === 'already_paid') {
      return reconciled
    }
    const err = new Error('toss_charge_network_error')
    err.cause = networkError
    err.paymentId = params.paymentId
    err.orderId = params.orderId
    err.needsReconciliation = true
    throw err
  }

  return withShortBillingTransaction(pool, async (client) =>
    applyTossBillingChargeResult(client, {
      chargeRes,
      paymentId: params.paymentId,
      userId: params.userId,
      orderId: params.orderId,
      totalAmount: params.totalAmount,
      source: params.source,
      periodAnchor: params.periodAnchor ?? null,
      secretKey: params.secretKey,
    }),
  )
}

/**
 * @param {import('pg').PoolClient} client
 * @deprecated Use runTossBillingChargeOutsideTransaction(pool, params). Kept for legacy callers/tests.
 */
export async function executeTossBillingCharge(client, params) {
  const pool = client?.connection?.pool ?? client?.pool
  if (!pool || typeof pool.connect !== 'function') {
    throw new Error('toss_charge_requires_pool_executor')
  }
  return runTossBillingChargeOutsideTransaction(pool, params)
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
    issuedMode: settings.mode,
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
 * @param {import('pg').Pool} pool
 * @param {{ userId: string; planCode?: string; billingCycle?: string; promotionCode?: string | null; testCode?: string | null; registerOnly?: boolean }} params
 */
export async function requestTossInsurancePayment(pool, params) {
  const userId = String(params.userId ?? '').trim()

  const prepared = await withShortBillingTransaction(pool, async (client) => {
    const settings = await resolvePaymentSettingsInternal(client)
    if (settings.provider !== 'toss' || !settings.isEnabled) {
      throw new Error('toss_billing_not_enabled')
    }
    if (!settings.hasSecretKey || !settings.secretKey) {
      throw new Error('payment_secret_storage_unavailable')
    }

    const billingCredential = await getActiveBillingKeyForUser(client, userId)
    if (!billingCredential?.billingKey) {
      return { needsBillingAuth: true, hasBillingKey: false, settings: null, billingCredential: null, pending: null }
    }

    if (params.registerOnly) {
      return {
        needsBillingAuth: false,
        hasBillingKey: true,
        registeredOnly: true,
        settings,
        billingCredential,
        pending: null,
      }
    }

    assertBillingCredentialModeMatch(billingCredential.issuedMode, settings.mode)

    const pending = await createPendingInsurancePaymentRow(client, {
      userId,
      planCode: params.planCode,
      billingCycle: params.billingCycle,
      promotionCode: params.promotionCode,
      provider: 'toss',
    })

    return { needsBillingAuth: false, hasBillingKey: true, settings, billingCredential, pending }
  })

  if (prepared.needsBillingAuth) {
    return { needsBillingAuth: true, hasBillingKey: false }
  }
  if (prepared.registeredOnly) {
    return { needsBillingAuth: false, hasBillingKey: true, registeredOnly: true }
  }

  const { settings, billingCredential, pending } = prepared
  if (!settings || !billingCredential || !pending) {
    throw new Error('toss_payment_prepare_failed')
  }

  if (Number(pending.totalAmount) <= 0) {
    const paid = await withShortBillingTransaction(pool, async (client) =>
      finalizeInsurancePaymentAsPaid(client, {
        paymentId: pending.paymentId,
        source: 'toss',
      }),
    )
    return {
      needsBillingAuth: false,
      hasBillingKey: true,
      ...pending,
      ...paid,
      status: 'paid',
      zeroAmountActivated: true,
    }
  }

  const result = await runTossBillingChargeOutsideTransaction(pool, {
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
    source: 'checkout',
  })

  return {
    needsBillingAuth: false,
    hasBillingKey: true,
    ...pending,
    ...result,
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ userId: string; planCode?: string; billingCycle?: string; testCode?: string | null }} params
 */
export async function completeTossInsurancePayment(pool, params) {
  return requestTossInsurancePayment(pool, params)
}
