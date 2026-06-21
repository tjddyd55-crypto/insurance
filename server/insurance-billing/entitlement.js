import {
  isInsuranceBillingEnabled,
  isInsuranceBillingEnforceAccess,
} from './config.js'
import { isInsuranceBillingEntitledStatus } from './subscriptionStatusPolicy.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { syncSubscriptionTrialExpiry } from './subscriptionLifecycle.js'

const BILLING_API_ALLOW_PREFIXES = Object.freeze([
  '/api/auth/',
  '/api/me',
  '/api/account/',
  '/api/subscription/',
  '/api/billing/',
  '/api/feature-request',
  '/api/feature-requests/',
  '/api/ga/validate',
])

/**
 * @param {string} requestPath
 */
export function isInsuranceBillingAllowlistedApi(requestPath) {
  if (typeof requestPath !== 'string' || requestPath.length === 0) {
    return false
  }
  return BILLING_API_ALLOW_PREFIXES.some(
    (prefix) => requestPath === prefix || requestPath.startsWith(prefix),
  )
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getInsuranceBillingSubscription(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      bs.id,
      bs.user_id,
      bs.tenant_id,
      bs.plan_code,
      bs.status,
      bs.billing_cycle,
      bs.current_period_start,
      bs.current_period_end,
      bs.trial_started_at,
      bs.trial_ends_at,
      bs.promotion_code_id,
      bs.created_at,
      bs.updated_at
    FROM billing_subscriptions bs
    WHERE bs.user_id = $1
    LIMIT 1
    `,
    [userId],
  )
  const row = r.rows[0] ?? null
  if (!row) {
    return null
  }
  return syncSubscriptionTrialExpiry(executor, row)
}

export { isInsuranceBillingEntitledStatus } from './subscriptionStatusPolicy.js'

/**
 * @param {{ status?: string | null }} subscription
 */
export function evaluateInsuranceBillingEntitlement(subscription) {
  if (!isInsuranceBillingEnabled()) {
    return { entitled: true, enforce: false, status: subscription?.status ?? null }
  }
  if (!isInsuranceBillingEnforceAccess()) {
    return {
      entitled: true,
      enforce: false,
      status: subscription?.status ?? null,
      noticeOnly: true,
    }
  }
  const status = String(subscription?.status ?? 'none').trim().toLowerCase()
  return {
    entitled: isInsuranceBillingEntitledStatus(status),
    enforce: true,
    status,
  }
}

/**
 * @param {import('express').Request & { user?: { id: string; role: string } }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {import('pg').Pool} pool
 */
export async function enforceInsuranceBillingEntitlement(req, res, next, pool) {
  try {
    if (!isInsuranceBillingEnabled() || !isInsuranceBillingEnforceAccess()) {
      next()
      return
    }
    if (!req.user?.id) {
      next()
      return
    }
    if (req.user.role !== 'USER') {
      next()
      return
    }
    if (isInsuranceBillingAllowlistedApi(req.path)) {
      next()
      return
    }

    const subscription = await getInsuranceBillingSubscription(pool, String(req.user.id))
    const verdict = evaluateInsuranceBillingEntitlement(subscription)
    if (verdict.entitled) {
      next()
      return
    }

    res.status(403).json({
      error: 'INSURANCE_BILLING_REQUIRED',
      message: '서비스 이용을 위해 결제가 필요합니다.',
      status: verdict.status,
      redirectPath: '/billing/required',
    })
  } catch (error) {
    console.error('[enforceInsuranceBillingEntitlement] open-fail:', error)
    next()
  }
}
