import { apiRequest } from '../../../lib/apiClient'
import type { ApplyPromotionResponse } from '../billingApplyPromotion'

export type BillingCheckoutConfig = {
  provider: string
  mode: 'virtual' | 'live' | string
  clientKey: string | null
  enabled: boolean
  customerKey: string | null
  hasBillingKey: boolean
  cardCompany?: string | null
  cardNumberMasked?: string | null
}

export type CheckoutSummary = {
  subscriptionStatus: string
  status?: string
  billingCycle: 'monthly' | 'yearly'
  trialEndsAt: string | null
  currentPeriodEnd?: string | null
  nextBillingAt?: string | null
  planName?: string
  accessPlan?: string
  isEntitled?: boolean
  daysRemaining?: number | null
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
  checkoutConfig?: BillingCheckoutConfig
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
    body: JSON.stringify(body),
  })
}

export async function applyBillingPromotionCode(
  token: string,
  body: { code: string; planCode?: string; billingCycle?: string },
) {
  return apiRequest<ApplyPromotionResponse>('/api/billing/checkout/apply-promotion', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
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
      body: JSON.stringify(body),
    },
  )
}

export async function requestBillingPayment(
  token: string,
  body: { planCode?: string; billingCycle?: string; promotionCode?: string; registerOnly?: boolean },
) {
  return apiRequest<{
    ok: boolean
    paymentId?: number
    status?: string
    subscriptionStatus?: string
    totalAmount?: number
    needsBillingAuth?: boolean
    hasBillingKey?: boolean
    checkoutConfig?: BillingCheckoutConfig
  }>(
    '/api/billing/payments/request',
    {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    },
  )
}

export async function confirmBillingAuth(
  token: string,
  body: { authKey: string; customerKey: string },
) {
  return apiRequest<{ ok: boolean; hasBillingKey: boolean }>(
    '/api/billing/payment-methods/auth-confirm',
    {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    },
  )
}

export async function fetchBillingCheckoutConfig(token: string) {
  return apiRequest<BillingCheckoutConfig>('/api/billing/checkout/config', { token })
}

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

export type BillingManageSummaryResponse = {
  summary: CheckoutSummary
  subscription: BillingManageSubscription | null
  payments: BillingManagePayment[]
  referral: { code: string; status: string } | null
}

export async function fetchBillingManageSummary(token: string) {
  return apiRequest<BillingManageSummaryResponse>('/api/billing/manage/summary', { token })
}
