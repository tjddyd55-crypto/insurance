/**
 * billing_subscriptions entitlement SSOT.
 * status 문자열만으로 CRM 접근을 판단하지 않는다.
 * trialing/trial 은 trial_ends_at(없으면 current_period_end) 이 아직 유효할 때만 entitled.
 */

import { formatKstDate } from '../../shared/dateTimeKst.js'

const PAID_STATUSES = Object.freeze([
  'active_paid',
  'active_manual',
  'legacy_active',
  'active',
  'paid',
  'free',
])

const TRIAL_STATUSES = Object.freeze(['trialing', 'trial'])

const BLOCKED_STATUSES = Object.freeze([
  'pending_payment',
  'pending',
  'past_due',
  'expired',
  'blocked',
  'canceled',
  'cancelled',
  'inactive',
  'none',
])

/**
 * @param {string | Date | null | undefined} value
 */
function toDate(value) {
  if (value == null) {
    return null
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const parsed = new Date(String(value).trim())
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * KST 달력 기준 trial 종료일이 아직 남았는지.
 * admin 표시(formatBillingDotDate / buildAdminUserSubscriptionListLabel)와 동일하게
 * KST 날짜 키로 비교해 자정 UTC 오판정을 줄인다.
 *
 * @param {string | Date | null | undefined} trialEndsAt
 * @param {Date} [now]
 */
export function isTrialPeriodActiveKst(trialEndsAt, now = new Date()) {
  const endKey = formatKstDate(trialEndsAt)
  if (!endKey) {
    return false
  }
  const todayKey = formatKstDate(now)
  if (!todayKey) {
    return false
  }
  return endKey >= todayKey
}

/**
 * @param {object | null | undefined} subscription
 * @param {Date} [now]
 * @returns {{ entitled: boolean; reason: string; trialEndsAt?: string | null }}
 */
export function evaluateActiveBillingEntitlement(subscription, now = new Date()) {
  if (!subscription) {
    return { entitled: false, reason: 'subscription_missing' }
  }

  const status = String(subscription.status ?? subscription.subscriptionStatus ?? '')
    .trim()
    .toLowerCase()

  if (!status) {
    return { entitled: false, reason: 'status_missing' }
  }

  if (PAID_STATUSES.includes(status)) {
    return { entitled: true, reason: status }
  }

  if (TRIAL_STATUSES.includes(status)) {
    const trialEndsAt =
      subscription.trial_ends_at ??
      subscription.trialEndsAt ??
      subscription.current_period_end ??
      subscription.currentPeriodEnd ??
      null

    if (isTrialPeriodActiveKst(trialEndsAt, now)) {
      return {
        entitled: true,
        reason: 'trial_active',
        trialEndsAt: trialEndsAt == null ? null : String(trialEndsAt),
      }
    }

    return {
      entitled: false,
      reason: 'trial_expired',
      trialEndsAt: trialEndsAt == null ? null : String(trialEndsAt),
    }
  }

  if (BLOCKED_STATUSES.includes(status)) {
    return { entitled: false, reason: status }
  }

  return { entitled: false, reason: 'unknown_status' }
}

/**
 * @param {object | null | undefined} subscription
 * @param {Date} [now]
 */
export function isActiveBillingEntitlement(subscription, now = new Date()) {
  return evaluateActiveBillingEntitlement(subscription, now).entitled
}

/**
 * @param {object | null | undefined} subscription
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isTrialExpiredForEntitlement(subscription, now = new Date()) {
  const status = String(subscription?.status ?? subscription?.subscriptionStatus ?? '')
    .trim()
    .toLowerCase()
  if (!TRIAL_STATUSES.includes(status)) {
    return false
  }
  const trialEndsAt =
    subscription?.trial_ends_at ??
    subscription?.trialEndsAt ??
    subscription?.current_period_end ??
    subscription?.currentPeriodEnd ??
    null
  if (!trialEndsAt) {
    return false
  }
  return !isTrialPeriodActiveKst(trialEndsAt, now)
}

/**
 * @param {string | null | undefined} iso
 */
export function resolveTrialEndsAtInstant(iso) {
  return toDate(iso)
}
