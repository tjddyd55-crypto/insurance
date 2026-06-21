import type { CheckoutSummary } from './api/insuranceBillingApi'

export type BillingManageSubscription = {
  status: string
  planName: string
  planCode: string
  billingCycle: 'monthly' | 'yearly'
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  trialStartedAt?: string | null
  trialEndsAt?: string | null
}

export type BillingManagePayment = {
  id: number
  status: string
  amount: number
  vatAmount: number
  totalAmount: number
  billingCycle: string
  provider: string
  planCode: string | null
  planName: string
  paidAt: string | null
  createdAt: string
  canceledAt?: string | null
}

export type BillingStatusTone = 'green' | 'blue' | 'orange' | 'red' | 'gray'

const STATUS_LABEL: Record<string, string> = {
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
}

const STATUS_TONE: Record<string, BillingStatusTone> = {
  pending_payment: 'red',
  pending: 'red',
  trialing: 'green',
  trial: 'green',
  active_paid: 'green',
  paid: 'green',
  legacy_active: 'gray',
  active: 'gray',
  free: 'gray',
  expired: 'red',
  blocked: 'red',
  past_due: 'orange',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  canceled: '취소됨',
  cancelled: '취소됨',
  failed: '실패',
}

const PAYMENT_STATUS_TONE: Record<string, BillingStatusTone> = {
  pending: 'orange',
  paid: 'green',
  canceled: 'gray',
  cancelled: 'gray',
  failed: 'red',
}

export function formatBillingDotDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export function formatBillingPeriod(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) return '—'
  return `${formatBillingDotDate(start)} ~ ${formatBillingDotDate(end)}`
}

export function resolveSubscriptionStatusLabel(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toLowerCase()
  return STATUS_LABEL[normalized] ?? '이용 상태 확인 필요'
}

export function resolveSubscriptionStatusTone(status: string | null | undefined): BillingStatusTone {
  const normalized = String(status ?? '').trim().toLowerCase()
  return STATUS_TONE[normalized] ?? 'gray'
}

export function resolvePaymentStatusLabel(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toLowerCase()
  return PAYMENT_STATUS_LABEL[normalized] ?? '결제 상태 확인 필요'
}

export function resolvePaymentStatusTone(status: string | null | undefined): BillingStatusTone {
  const normalized = String(status ?? '').trim().toLowerCase()
  return PAYMENT_STATUS_TONE[normalized] ?? 'gray'
}

export function resolvePlanDisplayName(
  subscription: BillingManageSubscription | null | undefined,
  summary: CheckoutSummary | null | undefined,
) {
  const planName = subscription?.planName ?? summary?.planName ?? summary?.plan?.name
  if (planName && planName.trim()) {
    return planName.trim()
  }
  if (subscription?.status === 'legacy_active') {
    return '기존 이용자 전환'
  }
  return '보험 CRM 베이직'
}

export function resolveNextBillingDate(
  subscription: BillingManageSubscription | null | undefined,
  summary: CheckoutSummary | null | undefined,
) {
  const status = String(subscription?.status ?? summary?.status ?? summary?.subscriptionStatus ?? '').toLowerCase()
  if (status === 'trialing' || status === 'trial') {
    return subscription?.trialEndsAt ?? summary?.trialEndsAt ?? null
  }
  return subscription?.nextBillingAt ?? subscription?.currentPeriodEnd ?? summary?.nextBillingAt ?? summary?.currentPeriodEnd ?? null
}

export function resolveUsagePeriod(
  subscription: BillingManageSubscription | null | undefined,
  summary: CheckoutSummary | null | undefined,
) {
  const status = String(subscription?.status ?? summary?.status ?? '').toLowerCase()
  if (status === 'trialing' || status === 'trial') {
    return formatBillingPeriod(
      subscription?.trialStartedAt ?? subscription?.currentPeriodStart,
      subscription?.trialEndsAt ?? summary?.trialEndsAt,
    )
  }
  return formatBillingPeriod(subscription?.currentPeriodStart, subscription?.currentPeriodEnd)
}

export function formatBillingCycleLabel(cycle: string | null | undefined) {
  return String(cycle ?? 'monthly').toLowerCase() === 'yearly' ? '연간' : '월간'
}

export function formatKrw(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function resolveManageCheckoutCtaLabel(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (normalized === 'active_paid' || normalized === 'paid') return '결제/요금제 변경'
  if (normalized === 'trialing' || normalized === 'trial') return '결제/요금제 확인'
  if (normalized === 'pending_payment' || normalized === 'pending') return '결제하러 가기'
  if (['legacy_active', 'active', 'free'].includes(normalized)) return '요금제 확인'
  return '결제/요금제 변경'
}
