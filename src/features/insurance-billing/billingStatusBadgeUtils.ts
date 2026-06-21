import type { CheckoutSummary } from './api/insuranceBillingApi'

export type BillingManageSummary = CheckoutSummary

export type BillingStatusBadgeTone = 'green' | 'blue' | 'orange' | 'red' | 'gray'

export type BillingStatusBadgeView = {
  label: string
  tone: BillingStatusBadgeTone
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

function resolveTrialingTone(daysRemaining: number | null | undefined): BillingStatusBadgeTone {
  if (daysRemaining == null) return 'green'
  if (daysRemaining <= 1) return 'red'
  if (daysRemaining <= 7) return 'orange'
  return 'green'
}

export function buildBillingStatusBadgeView(summary: BillingManageSummary | null | undefined): BillingStatusBadgeView | null {
  if (!summary) return null

  const status = String(summary.status ?? summary.subscriptionStatus ?? '').trim().toLowerCase()
  const trialEndsAt = summary.trialEndsAt
  const nextBillingAt = summary.nextBillingAt ?? summary.currentPeriodEnd
  const daysRemaining = summary.daysRemaining ?? null

  switch (status) {
    case 'pending_payment':
    case 'pending':
      return { label: '결제 필요', tone: 'red', href: '/billing/checkout' }
    case 'trialing':
    case 'trial': {
      const dateLabel = formatDotDate(trialEndsAt)
      if (daysRemaining != null && daysRemaining <= 7 && daysRemaining >= 0) {
        return {
          label: `무료 D-${daysRemaining} · ${dateLabel} 종료`,
          tone: resolveTrialingTone(daysRemaining),
          href: '/account/billing',
        }
      }
      return {
        label: dateLabel ? `무료 이용 중 · ${dateLabel}까지` : '무료 이용 중',
        tone: resolveTrialingTone(daysRemaining),
        href: '/account/billing',
      }
    }
    case 'active_paid':
    case 'paid': {
      const dateLabel = formatDotDate(nextBillingAt)
      return {
        label: dateLabel ? `유료 이용 중 · 다음 결제일 ${dateLabel}` : '유료 이용 중',
        tone: 'green',
        href: '/account/billing',
      }
    }
    case 'legacy_active':
    case 'active':
    case 'free':
      return { label: '기존 이용자', tone: 'gray', href: '/account/billing' }
    case 'expired':
      return { label: '무료기간 종료 · 결제 필요', tone: 'red', href: '/billing/required' }
    case 'blocked':
      return { label: '결제 필요', tone: 'red', href: '/billing/required' }
    case 'past_due':
      return { label: '결제 확인 필요', tone: 'orange', href: '/billing/manage' }
    default:
      return null
  }
}
