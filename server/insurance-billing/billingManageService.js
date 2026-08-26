import { INSURANCE_BASIC_PLAN_CODE } from './config.js'
import { enrichBillingManageSummary } from './billingSummaryService.js'
import { getCheckoutSummary } from './promotionService.js'
import { getBillingReferralForUser, syncSubscriptionTrialExpiry } from './subscriptionLifecycle.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import {
  loadBillingPlanAmounts,
  normalizeBillingCycle,
  resolveAutoRenewStatus,
  resolveEffectiveRenewalBillingCycle,
  resolveNextChargeAmountFromPlan,
} from './subscriptionManageActions.js'

/**
 * @param {object} row
 */
function mapUserPaymentRow(row) {
  return {
    id: Number(row.id),
    status: String(row.status ?? ''),
    amount: Number(row.amount ?? 0),
    vatAmount: Number(row.vat_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    billingCycle: String(row.billing_cycle ?? 'monthly'),
    provider: String(row.provider ?? ''),
    planCode: row.plan_code ? String(row.plan_code) : null,
    planName: String(row.plan_name ?? row.plan_code ?? ''),
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    canceledAt: row.canceled_at ?? null,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 */
export async function listUserBillingPayments(executor, userId, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit ?? 50) || 50, 1), 100)
  const r = await systemQuery(
    executor,
    `
    SELECT
      bp.id,
      bp.status,
      bp.amount,
      bp.vat_amount,
      bp.total_amount,
      bp.billing_cycle,
      bp.provider,
      bp.paid_at,
      bp.created_at,
      bp.canceled_at,
      COALESCE(bp.plan_code, bs.plan_code) AS plan_code,
      COALESCE(pl.name, bp.plan_code, bs.plan_code) AS plan_name
    FROM billing_payments bp
    LEFT JOIN billing_subscriptions bs ON bs.id = bp.subscription_id
    LEFT JOIN billing_plans pl ON pl.code = COALESCE(bp.plan_code, bs.plan_code)
    WHERE bp.user_id = $1
    ORDER BY bp.created_at DESC, bp.id DESC
    LIMIT $2
    `,
    [userId, limit],
  )
  return r.rows.map(mapUserPaymentRow)
}

/**
 * @param {object | null | undefined} subRow
 * @param {{
 *   planName?: string
 *   planCode?: string
 *   billingCycle?: string
 *   hasBillingCredential?: boolean
 *   planAmounts?: object | null
 * }} planMeta
 */
export function buildManageSubscriptionView(subRow, planMeta = {}) {
  const status = String(subRow?.status ?? 'pending_payment').trim()
  const planCode = String(planMeta.planCode ?? subRow?.plan_code ?? INSURANCE_BASIC_PLAN_CODE)
  const planName = String(planMeta.planName ?? planCode)
  const billingCycle = normalizeBillingCycle(planMeta.billingCycle ?? subRow?.billing_cycle)
  const pendingRaw = subRow?.pending_billing_cycle
  const pendingBillingCycle =
    pendingRaw == null || String(pendingRaw).trim() === ''
      ? null
      : normalizeBillingCycle(pendingRaw)
  const cancelAt = subRow?.cancel_at ?? null
  const canceledAt = subRow?.canceled_at ?? null
  const hasBillingCredential = Boolean(planMeta.hasBillingCredential)
  const autoRenewStatus = resolveAutoRenewStatus({
    status,
    cancelAt,
    canceledAt,
    hasBillingCredential,
  })
  const nextChargeCycle = resolveEffectiveRenewalBillingCycle({
    billingCycle,
    pendingBillingCycle,
  })
  const amounts =
    status === 'active_paid' && !cancelAt && !canceledAt
      ? resolveNextChargeAmountFromPlan(planMeta.planAmounts, nextChargeCycle)
      : null

  return {
    status,
    planName,
    planCode,
    billingCycle,
    pendingBillingCycle,
    autoRenewStatus,
    cancelAt,
    canceledAt,
    currentPeriodStart: subRow?.current_period_start ?? null,
    currentPeriodEnd: subRow?.current_period_end ?? null,
    nextBillingAt: subRow?.next_billing_at ?? subRow?.current_period_end ?? null,
    nextChargeAmount: amounts?.totalAmount ?? null,
    nextChargeSupplyAmount: amounts?.supplyAmount ?? null,
    nextChargeVatAmount: amounts?.vatAmount ?? null,
    nextChargeBillingCycle: amounts ? nextChargeCycle : null,
    trialStartedAt: subRow?.trial_started_at ?? null,
    trialEndsAt: subRow?.trial_ends_at ?? null,
    hasBillingCredential,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function buildBillingManageSummaryResponse(executor, userId) {
  const [checkoutSummary, subRaw, referral, payments, credentialCount] = await Promise.all([
    getCheckoutSummary(executor, userId),
    systemQuery(
      executor,
      `
      SELECT
        id, user_id, tenant_id, plan_code, status, billing_cycle, pending_billing_cycle,
        current_period_start, current_period_end, next_billing_at,
        trial_started_at, trial_ends_at, promotion_code_id,
        cancel_at, canceled_at,
        created_at, updated_at
      FROM billing_subscriptions
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    ).then((r) => syncSubscriptionTrialExpiry(executor, r.rows[0] ?? null)),
    getBillingReferralForUser(executor, userId),
    listUserBillingPayments(executor, userId),
    systemQuery(
      executor,
      `
      SELECT 1
      FROM billing_payment_credentials
      WHERE user_id = $1
        AND status = 'active'
        AND billing_key_ciphertext IS NOT NULL
      LIMIT 1
      `,
      [userId],
    ).then((r) => Boolean(r.rows[0])),
  ])

  const summary = enrichBillingManageSummary(checkoutSummary)
  const planAmounts = await loadBillingPlanAmounts(
    executor,
    subRaw?.plan_code ?? summary.accessPlan ?? INSURANCE_BASIC_PLAN_CODE,
  )
  const subscription = buildManageSubscriptionView(subRaw, {
    planName: summary.planName,
    planCode: summary.accessPlan,
    billingCycle: subRaw?.billing_cycle ?? summary.billingCycle,
    hasBillingCredential: credentialCount,
    planAmounts,
  })

  return {
    summary,
    subscription,
    payments,
    referral: referral
      ? {
          code: referral.referral_code,
          status: referral.status,
        }
      : null,
  }
}

export { mapUserPaymentRow }
