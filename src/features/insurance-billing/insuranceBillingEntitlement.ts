/**
 * billing entitlement — frontend mirror of server/subscriptionEntitlementPolicy.js
 * status 문자열만으로 trialing entitlement 를 판단하지 않는다.
 */

export type BillingEntitlementInput = {
  subscriptionStatus?: string | null
  status?: string | null
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  isEntitled?: boolean
}

function formatKstDateKey(iso: string | Date | null | undefined): string | null {
  if (iso == null) return null
  const d = iso instanceof Date ? iso : new Date(String(iso).trim())
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function isTrialPeriodActiveKstClient(
  trialEndsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const endKey = formatKstDateKey(trialEndsAt)
  if (!endKey) return false
  const todayKey = formatKstDateKey(now)
  if (!todayKey) return false
  return endKey >= todayKey
}

const PAID_STATUSES = new Set([
  'active_paid',
  'active_manual',
  'legacy_active',
  'active',
  'paid',
  'free',
])

const TRIAL_STATUSES = new Set(['trialing', 'trial'])

export function evaluateActiveBillingEntitlementClient(
  input: BillingEntitlementInput | null | undefined,
  now: Date = new Date(),
): { entitled: boolean; reason: string } {
  if (input?.isEntitled === true) {
    return { entitled: true, reason: 'server_is_entitled' }
  }
  if (input?.isEntitled === false) {
    return { entitled: false, reason: 'server_not_entitled' }
  }

  const status = String(input?.subscriptionStatus ?? input?.status ?? '')
    .trim()
    .toLowerCase()

  if (!status) {
    return { entitled: false, reason: 'status_missing' }
  }

  if (PAID_STATUSES.has(status)) {
    return { entitled: true, reason: status }
  }

  if (TRIAL_STATUSES.has(status)) {
    const trialEndsAt = input?.trialEndsAt ?? input?.currentPeriodEnd ?? null
    if (isTrialPeriodActiveKstClient(trialEndsAt, now)) {
      return { entitled: true, reason: 'trial_active' }
    }
    return { entitled: false, reason: 'trial_expired' }
  }

  return { entitled: false, reason: status }
}

export function hasActiveBillingEntitlementClient(
  input: BillingEntitlementInput | null | undefined,
  now?: Date,
): boolean {
  return evaluateActiveBillingEntitlementClient(input, now).entitled
}

export function resolveBillingAccessRedirectPath(
  defaultPath: string,
  input: BillingEntitlementInput | null | undefined,
): string {
  const verdict = evaluateActiveBillingEntitlementClient(input)
  if (verdict.entitled) {
    return defaultPath
  }

  const status = String(input?.subscriptionStatus ?? input?.status ?? '')
    .trim()
    .toLowerCase()

  if (!status || status === 'pending_payment' || status === 'none') {
    return '/billing/checkout'
  }

  return '/billing/required'
}

export function resolveBillingProfileEntryPath(input: {
  hasBillingKey: boolean
  subscriptionStatus?: string | null
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  isEntitled?: boolean
}): '/billing/checkout' | '/billing/manage' {
  if (input.hasBillingKey) {
    return '/billing/manage'
  }
  if (
    hasActiveBillingEntitlementClient({
      subscriptionStatus: input.subscriptionStatus,
      trialEndsAt: input.trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
      isEntitled: input.isEntitled,
    })
  ) {
    return '/billing/manage'
  }
  return '/billing/checkout'
}
