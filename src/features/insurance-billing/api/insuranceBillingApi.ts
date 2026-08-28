import { apiRequest } from '../../../lib/apiClient'
import type { ApplyPromotionResponse } from '../billingApplyPromotion'

export type BillingCheckoutConfig = {
  provider: string
  mode: 'virtual' | 'live' | string
  clientKey: string | null
  enabled: boolean
  customerKey: string | null
  hasBillingKey: boolean
  allowDevTestCharge?: boolean
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
  errorCode?: string
}

export type CheckoutQuote = {
  valid: boolean
  planCode: string
  planName: string
  billingCycle: 'monthly' | 'yearly'
  baseAmount: number
  baseSupplyAmount?: number
  baseVatAmount?: number
  discountAmount: number
  todayChargeAmount: number
  todaySupplyAmount?: number
  todayVatAmount?: number
  nextChargeAmount: number
  nextBillingAt: string | null
  coupon: {
    code: string
    type: string
    freeMonths?: number | null
    discountAmount: number
    finalAmount: number
    message?: string | null
  } | null
  message?: string | null
  errorCode?: string | null
  summaryMessage: string
  benefitKind: 'none' | 'free_months' | 'amount_off' | 'percent_off' | string | null
}

export async function fetchCheckoutQuote(
  token: string,
  body: { planCode?: string; billingCycle: string; promotionCode?: string | null },
) {
  return apiRequest<{ ok: boolean; quote: CheckoutQuote }>('/api/billing/checkout/quote', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
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
  body: { planCode?: string; billingCycle?: string; promotionCode?: string; registerOnly?: boolean; testCode?: string | null },
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

export type AutoRenewStatus = 'AUTO_RENEW_ACTIVE' | 'CANCEL_SCHEDULED' | 'CANCELED' | 'INACTIVE'

export type BillingManageSubscription = {
  status: string
  planName: string
  planCode: string
  billingCycle: 'monthly' | 'yearly'
  pendingBillingCycle?: 'monthly' | 'yearly' | null
  autoRenewStatus?: AutoRenewStatus
  cancelAt?: string | null
  canceledAt?: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  nextBillingAt: string | null
  nextChargeAmount?: number | null
  nextChargeSupplyAmount?: number | null
  nextChargeVatAmount?: number | null
  nextChargeBillingCycle?: 'monthly' | 'yearly' | null
  trialStartedAt?: string | null
  trialEndsAt?: string | null
  hasBillingCredential?: boolean
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

export type BillingSubscriptionActionResponse = {
  ok: boolean
  noOp?: boolean
  billingCycle?: 'monthly' | 'yearly'
  pendingBillingCycle?: 'monthly' | 'yearly' | null
  cancelAt?: string | null
  currentPeriodEnd?: string | null
  nextBillingAt?: string | null
  requiresCard?: boolean
  subscription?: BillingManageSubscription
}

export async function changeBillingCycle(token: string, billingCycle: 'monthly' | 'yearly') {
  return apiRequest<BillingSubscriptionActionResponse>('/api/billing/subscription/billing-cycle', {
    token,
    method: 'PATCH',
    body: JSON.stringify({ billingCycle }),
  })
}

export async function clearPendingBillingCycleChange(token: string) {
  return apiRequest<BillingSubscriptionActionResponse>('/api/billing/subscription/pending-billing-cycle', {
    token,
    method: 'DELETE',
  })
}

export async function cancelBillingSubscription(token: string) {
  return apiRequest<BillingSubscriptionActionResponse>('/api/billing/subscription/cancel', {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function resumeBillingSubscription(token: string) {
  return apiRequest<BillingSubscriptionActionResponse>('/api/billing/subscription/resume', {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  })
}
