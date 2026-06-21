import type { CheckoutSummary } from './api/insuranceBillingApi'

export type BillingManageSummary = CheckoutSummary

export type BillingStatusBadgeVariant =
  | 'pending'
  | 'trialing'
  | 'active-paid'
  | 'legacy'
  | 'expired'
  | 'past-due'
  | 'blocked'

export type BillingStatusBadgeView = {
  label: string
  variant: BillingStatusBadgeVariant
  href: string
}

function formatDotDate(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export function buildBillingStatusBadgeView(summary: BillingManageSummary | null | undefined): BillingStatusBadgeView | null {
  if (!summary) return null

  const status = String(summary.status ?? summary.subscriptionStatus ?? '').trim().toLowerCase()
  const trialEndsAt = summary.trialEndsAt
  const nextBillingAt = summary.nextBillingAt ?? summary.currentPeriodEnd

  switch (status) {
    case 'pending_payment':
    case 'pending':
      return { label: '결제 필요', variant: 'pending', href: '/billing/checkout' }
    case 'trialing':
    case 'trial': {
      const dateLabel = formatDotDate(trialEndsAt)
      return {
        label: dateLabel ? `무료 이용 중 · ${dateLabel}까지` : '무료 이용 중',
        variant: 'trialing',
        href: '/account/billing',
      }
    }
    case 'active_paid':
    case 'paid': {
      const dateLabel = formatDotDate(nextBillingAt)
      return {
        label: dateLabel ? `유료 이용 중 · 다음 결제일 ${dateLabel}` : '유료 이용 중',
        variant: 'active-paid',
        href: '/account/billing',
      }
    }
    case 'legacy_active':
    case 'active':
    case 'free':
      return { label: '기존 이용자', variant: 'legacy', href: '/account/billing' }
    case 'expired':
      return { label: '무료기간 종료', variant: 'expired', href: '/billing/required' }
    case 'blocked':
      return { label: '이용 제한', variant: 'blocked', href: '/billing/required' }
    case 'past_due':
      return { label: '결제 확인 필요', variant: 'past-due', href: '/billing/manage' }
    default:
      return null
  }
}
