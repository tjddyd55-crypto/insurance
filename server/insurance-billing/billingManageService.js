import { INSURANCE_BASIC_PLAN_CODE } from './config.js'
import { enrichBillingManageSummary } from './billingSummaryService.js'
import { getCheckoutSummary } from './promotionService.js'
import { getBillingReferralForUser, syncSubscriptionTrialExpiry } from './subscriptionLifecycle.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

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
 * @param {{ planName?: string; planCode?: string; billingCycle?: string }} planMeta
 */
export function buildManageSubscriptionView(subRow, planMeta = {}) {
  const status = String(subRow?.status ?? 'pending_payment').trim()
  const planCode = String(planMeta.planCode ?? subRow?.plan_code ?? INSURANCE_BASIC_PLAN_CODE)
  const planName = String(planMeta.planName ?? planCode)
  const billingCycle =
    String(planMeta.billingCycle ?? subRow?.billing_cycle ?? 'monthly').toLowerCase() === 'yearly'
      ? 'yearly'
      : 'monthly'

  return {
    status,
    planName,
    planCode,
    billingCycle,
    currentPeriodStart: subRow?.current_period_start ?? null,
    currentPeriodEnd: subRow?.current_period_end ?? null,
    nextBillingAt: subRow?.next_billing_at ?? subRow?.current_period_end ?? null,
    trialStartedAt: subRow?.trial_started_at ?? null,
    trialEndsAt: subRow?.trial_ends_at ?? null,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function buildBillingManageSummaryResponse(executor, userId) {
  const [checkoutSummary, subRaw, referral, payments] = await Promise.all([
    getCheckoutSummary(executor, userId),
    systemQuery(
      executor,
      `
      SELECT
        id, user_id, tenant_id, plan_code, status, billing_cycle,
        current_period_start, current_period_end, next_billing_at,
        trial_started_at, trial_ends_at, promotion_code_id,
        created_at, updated_at
      FROM billing_subscriptions
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    ).then((r) => syncSubscriptionTrialExpiry(executor, r.rows[0] ?? null)),
    getBillingReferralForUser(executor, userId),
    listUserBillingPayments(executor, userId),
  ])

  const summary = enrichBillingManageSummary(checkoutSummary)
  const subscription = buildManageSubscriptionView(subRaw, {
    planName: summary.planName,
    planCode: summary.accessPlan,
    billingCycle: summary.billingCycle,
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
