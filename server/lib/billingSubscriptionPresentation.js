/**
 * billing_subscriptions.status 한글 라벨 — billingManageViewUtils.ts 와 동일 SSOT.
 */

/** @type {Readonly<Record<string, string>>} */
export const BILLING_SUBSCRIPTION_STATUS_LABEL = Object.freeze({
  pending_payment: '결제 필요',
  pending: '결제 필요',
  trialing: '무료 이용 중',
  trial: '무료 이용 중',
  active_paid: '유료 이용 중',
  paid: '유료 이용 중',
  legacy_active: '기존 이용자',
  active: '기존 이용자',
  free: '기존 이용자',
  expired: '무료기간 종료',
  blocked: '이용 제한',
  past_due: '결제 확인 필요',
  canceled: '해지',
  cancelled: '해지',
  none: '구독 없음',
})

/**
 * @param {string | null | undefined} status
 */
export function resolveSubscriptionStatusLabel(status) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized) {
    return BILLING_SUBSCRIPTION_STATUS_LABEL.none
  }
  return BILLING_SUBSCRIPTION_STATUS_LABEL[normalized] ?? '이용 상태 확인 필요'
}

/**
 * @param {string | Date | null | undefined} value
 */
export function toIsoStringOrNull(value) {
  if (value == null) {
    return null
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }
  const text = String(value).trim()
  if (!text) {
    return null
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * @param {string | null | undefined} iso
 */
export function formatBillingDotDate(iso) {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}.${pick('month')}.${pick('day')}`
}

/**
 * @param {string | null | undefined} status
 * @param {string | null | undefined} trialEndsAt
 * @param {string | null | undefined} nextBillingAt
 * @param {string | null | undefined} currentPeriodEnd
 */
export function resolveSubscriptionUntilIso(status, trialEndsAt, nextBillingAt, currentPeriodEnd) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (normalized === 'trialing' || normalized === 'trial') {
    return toIsoStringOrNull(trialEndsAt) ?? toIsoStringOrNull(currentPeriodEnd)
  }
  if (normalized === 'active_paid' || normalized === 'paid') {
    return toIsoStringOrNull(nextBillingAt) ?? toIsoStringOrNull(currentPeriodEnd)
  }
  return null
}

/**
 * @param {string | null | undefined} status
 * @param {string | null | undefined} trialEndsAt
 * @param {string | null | undefined} nextBillingAt
 * @param {string | null | undefined} currentPeriodEnd
 */
export function buildAdminUserSubscriptionListLabel(status, trialEndsAt, nextBillingAt, currentPeriodEnd) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'none') {
    return BILLING_SUBSCRIPTION_STATUS_LABEL.none
  }
  const label = resolveSubscriptionStatusLabel(status)
  const untilIso = resolveSubscriptionUntilIso(status, trialEndsAt, nextBillingAt, currentPeriodEnd)
  if (
    untilIso &&
    (normalized === 'trialing' ||
      normalized === 'trial' ||
      normalized === 'active_paid' ||
      normalized === 'paid')
  ) {
    const dateLabel = formatBillingDotDate(untilIso)
    if (dateLabel) {
      return `${label} · ${dateLabel}까지`
    }
  }
  return label
}
