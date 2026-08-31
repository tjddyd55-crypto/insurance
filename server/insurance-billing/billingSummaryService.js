import { INSURANCE_BASIC_PLAN_CODE } from './config.js'
import { evaluateActiveBillingEntitlement } from './subscriptionEntitlementPolicy.js'

const MS_PER_DAY = 86400000

/**
 * @param {string | null | undefined} isoDate
 * @returns {number | null}
 */
export function computeDaysRemaining(isoDate) {
  if (!isoDate) {
    return null
  }
  const end = new Date(isoDate).getTime()
  if (Number.isNaN(end)) {
    return null
  }
  return Math.ceil((end - Date.now()) / MS_PER_DAY)
}

/**
 * checkout / manage summary 공통 필드 보강
 *
 * @param {object} summary
 */
export function enrichBillingManageSummary(summary) {
  const status = String(summary?.subscriptionStatus ?? 'pending_payment').trim()
  const planName = summary?.plan?.name ?? '보험 CRM 베이직'
  const accessPlan = summary?.plan?.code ?? INSURANCE_BASIC_PLAN_CODE
  const entitlement = evaluateActiveBillingEntitlement({
    status,
    trialEndsAt: summary?.trialEndsAt ?? null,
    currentPeriodEnd: summary?.currentPeriodEnd ?? null,
  })
  const isEntitled = entitlement.entitled

  let daysRemaining = null
  if (status === 'trialing') {
    daysRemaining = computeDaysRemaining(summary?.trialEndsAt)
  } else if (status === 'active_paid') {
    daysRemaining = computeDaysRemaining(summary?.nextBillingAt ?? summary?.currentPeriodEnd)
  }

  return {
    ...summary,
    status,
    planName,
    accessPlan,
    isEntitled,
    entitlementReason: entitlement.reason,
    daysRemaining,
  }
}
