import {
  buildBillingStatusBadgeView,
  type BillingManageSummary,
} from '../insurance-billing/billingStatusBadgeUtils'
import {
  resolveSubscriptionStatusLabel,
  resolveSubscriptionStatusTone,
  type BillingStatusTone,
} from '../insurance-billing/billingManageViewUtils'
import { formatKstDateDots } from '../../utils/displayDateTime'

export type AdminUserSubscriptionFilter =
  | ''
  | 'active_paid'
  | 'trialing'
  | 'pending_payment'
  | 'past_due'
  | 'expired'
  | 'canceled'
  | 'none'

export const ADMIN_USER_SUBSCRIPTION_FILTER_OPTIONS: {
  value: AdminUserSubscriptionFilter
  label: string
}[] = [
  { value: '', label: '전체' },
  { value: 'active_paid', label: resolveSubscriptionStatusLabel('active_paid') },
  { value: 'trialing', label: resolveSubscriptionStatusLabel('trialing') },
  { value: 'pending_payment', label: resolveSubscriptionStatusLabel('pending_payment') },
  { value: 'past_due', label: resolveSubscriptionStatusLabel('past_due') },
  { value: 'expired', label: resolveSubscriptionStatusLabel('expired') },
  { value: 'canceled', label: resolveSubscriptionStatusLabel('canceled') },
  { value: 'none', label: resolveSubscriptionStatusLabel('none') },
]

function getKstDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function formatKstClockLabel(iso: string): string {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('dayPeriod')} ${pick('hour')}:${pick('minute')}`
}

function formatKstDateTimeLabel(iso: string, compact: boolean): string {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const year = pick('year')
  const month = pick('month').padStart(2, '0')
  const day = pick('day').padStart(2, '0')
  const clock = `${pick('dayPeriod')} ${pick('hour')}:${pick('minute')}`
  if (compact) {
    return `${month}.${day} ${clock}`
  }
  return `${year}.${month}.${day} ${clock}`
}

export function formatAdminUserLastLogin(
  iso: string | null | undefined,
  compact = false,
): string {
  if (!iso) {
    return '접속 기록 없음'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '접속 기록 없음'
  }
  const todayKey = getKstDateKey(new Date().toISOString())
  const targetKey = getKstDateKey(iso)
  const yesterdayKey = getKstDateKey(new Date(Date.now() - 86_400_000).toISOString())
  const clock = formatKstClockLabel(iso)
  if (targetKey === todayKey) {
    return `오늘 ${clock}`
  }
  if (targetKey === yesterdayKey) {
    return `어제 ${clock}`
  }
  return formatKstDateTimeLabel(iso, compact)
}

export function resolveAdminUserSubscriptionTone(
  status: string | null | undefined,
): BillingStatusTone {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'none') {
    return 'gray'
  }
  return resolveSubscriptionStatusTone(status)
}

export function resolveAdminUserSubscriptionBadgeClass(status: string | null | undefined): string {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized || normalized === 'none') {
    return 'admin-subscription-badge--none'
  }
  if (normalized === 'active_paid' || normalized === 'paid') {
    return 'admin-subscription-badge--active-paid'
  }
  if (normalized === 'trialing' || normalized === 'trial') {
    return 'admin-subscription-badge--trialing'
  }
  if (normalized === 'pending_payment' || normalized === 'pending') {
    return 'admin-subscription-badge--pending-payment'
  }
  if (normalized === 'legacy_active' || normalized === 'active' || normalized === 'free') {
    return 'admin-subscription-badge--legacy'
  }
  if (
    normalized === 'past_due' ||
    normalized === 'expired' ||
    normalized === 'canceled' ||
    normalized === 'cancelled' ||
    normalized === 'blocked'
  ) {
    return 'admin-subscription-badge--warning'
  }
  return 'admin-subscription-badge--unknown'
}

export function formatAdminUserSubscriptionListLabel(row: {
  subscription_list_label?: string | null
  subscription_status?: string | null
  subscription_status_label?: string | null
  subscription_until?: string | null
}): string {
  if (row.subscription_list_label?.trim()) {
    return row.subscription_list_label.trim()
  }
  const status = String(row.subscription_status ?? '').trim().toLowerCase()
  if (!status || status === 'none') {
    return resolveSubscriptionStatusLabel('none')
  }
  const summary: BillingManageSummary = {
    status,
    subscriptionStatus: status,
    trialEndsAt: status === 'trialing' || status === 'trial' ? row.subscription_until : null,
    nextBillingAt:
      status === 'active_paid' || status === 'paid' ? row.subscription_until : null,
    currentPeriodEnd: row.subscription_until,
  }
  const badge = buildBillingStatusBadgeView(summary)
  if (badge?.label) {
    return badge.label
  }
  const label = row.subscription_status_label?.trim() || resolveSubscriptionStatusLabel(status)
  const until = formatKstDateDots(row.subscription_until)
  if (
    until &&
    (status === 'trialing' || status === 'trial' || status === 'active_paid' || status === 'paid')
  ) {
    return `${label} · ${until}까지`
  }
  return label
}
