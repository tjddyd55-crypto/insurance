import { apiRequest } from '../../../lib/apiClient'

export type CheckoutSummary = {
  subscriptionStatus: string
  billingCycle: 'monthly' | 'yearly'
  trialEndsAt: string | null
  plan: {
    code: string
    name: string
    monthlyPrice: number
    monthlyVat: number
    monthlyTotal: number
    yearlyPrice: number
    yearlyVat: number
    yearlyTotal: number
    currency: string
  } | null
  referral: { code: string; status: string } | null
  billingEnabled?: boolean
  enforceAccess?: boolean
  provider?: string
}

export type PromotionValidateResult = {
  valid: boolean
  code?: string
  type?: string
  freeMonths?: number | null
  discountAmount?: number
  finalAmount?: number
  message?: string
}

export async function fetchCheckoutSummary(token: string) {
  return apiRequest<CheckoutSummary>('/api/billing/checkout/summary', { token })
}

export async function validateBillingPromotionCode(
  token: string,
  body: { code: string; planCode?: string; billingCycle?: string },
) {
  return apiRequest<PromotionValidateResult>('/api/billing/promotion-codes/validate', {
    method: 'POST',
    token,
    body,
  })
}

export async function applyBillingPromotionCode(
  token: string,
  body: { code: string; planCode?: string; billingCycle?: string },
) {
  return apiRequest<{
    ok: boolean
    status?: string
    trialEndsAt?: string
    freeMonths?: number
    message?: string
  }>('/api/billing/checkout/apply-promotion', {
    method: 'POST',
    token,
    body,
  })
}

export async function completeMockBillingPayment(
  token: string,
  body: { planCode?: string; billingCycle?: string },
) {
  return apiRequest<{ ok: boolean; subscriptionStatus: string; totalAmount: number }>(
    '/api/billing/mock-payments/complete',
    {
      method: 'POST',
      token,
      body,
    },
  )
}

export async function fetchBillingManageSummary(token: string) {
  return apiRequest<{
    summary: CheckoutSummary
    subscription: Record<string, unknown> | null
    referral: Record<string, unknown> | null
  }>('/api/billing/manage/summary', { token })
}
