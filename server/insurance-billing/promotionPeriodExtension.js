import { addCalendarMonthsKst as addMonths } from './billingPeriodDate.js'

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

const ENTITLED_STATUSES = new Set([
  'trialing',
  'trial',
  'active_paid',
  'active_manual',
  'legacy_active',
  'active',
  'paid',
  'free',
])

/**
 * 기간형 쿠폰 연장 기준일 — 미래 entitlement 종료일이 있으면 그 날짜부터, 없으면 now.
 *
 * @param {object | null | undefined} subscription
 * @param {Date} [now]
 */
export function resolvePromotionExtensionBaseDate(subscription, now = new Date()) {
  const nowMs = now.getTime()
  const candidates = [
    subscription?.trial_ends_at,
    subscription?.trialEndsAt,
    subscription?.current_period_end,
    subscription?.currentPeriodEnd,
    subscription?.next_billing_at,
    subscription?.nextBillingAt,
  ]
    .map((value) => toDate(value))
    .filter((date) => date && date.getTime() > nowMs)

  if (candidates.length === 0) {
    return now
  }
  return new Date(Math.max(...candidates.map((date) => date.getTime())))
}

/**
 * @param {object | null | undefined} subscription
 * @param {number} freeMonths
 * @param {Date} [now]
 */
export function computeFreeMonthsPromotionEndAt(subscription, freeMonths, now = new Date()) {
  const months = Math.min(12, Math.max(1, Math.floor(Number(freeMonths) || 0)))
  const baseDate = resolvePromotionExtensionBaseDate(subscription, now)
  return addMonths(baseDate, months)
}

/**
 * @param {string | null | undefined} status
 */
export function resolvePromotionApplyTargetStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (ENTITLED_STATUSES.has(normalized)) {
    return normalized === 'trial' ? 'trialing' : normalized
  }
  return 'trialing'
}
