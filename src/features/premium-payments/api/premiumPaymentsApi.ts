import { ApiError, apiRequest } from '../../../lib/apiClient'

export type PremiumPaymentMethodRow = {
  id: number
  gaId: number
  ownerUserId: string
  customerId: number
  customerName?: string
  insuranceCompany: string
  policyNumber: string
  cardholderName: string
  maskedCardNumber: string
  cardNumberLast4: string
  cardBrand: string | null
  cardExpiryMonth: number
  cardExpiryYear: number
  memo: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type PremiumPaymentWritePayload = {
  insuranceCompany: string
  policyNumber: string
  cardholderName: string
  cardNumber?: string
  cardExpiryMonth: number
  cardExpiryYear: number
  memo?: string
}

export type PremiumPaymentRevealResponse = {
  cardNumber: string
  cardNumberLast4: string
  maskedCardNumber: string
}

export type PremiumPaymentReauthResponse = {
  reauthToken: string
  expiresInSeconds: number
  maskedCardNumber: string
}

function requireToken(token: string) {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
}

export async function listCustomerPremiumPayments(
  token: string,
  customerId: number,
): Promise<PremiumPaymentMethodRow[]> {
  requireToken(token)
  const data = await apiRequest<{ premiumPayments: PremiumPaymentMethodRow[] }>(
    `/api/customers/${customerId}/premium-payments`,
    { token },
  )
  return Array.isArray(data.premiumPayments) ? data.premiumPayments : []
}

export async function createCustomerPremiumPayment(
  token: string,
  customerId: number,
  payload: PremiumPaymentWritePayload,
): Promise<PremiumPaymentMethodRow> {
  requireToken(token)
  return apiRequest<PremiumPaymentMethodRow>(`/api/customers/${customerId}/premium-payments`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function updateCustomerPremiumPayment(
  token: string,
  customerId: number,
  paymentId: number,
  payload: PremiumPaymentWritePayload,
): Promise<PremiumPaymentMethodRow> {
  requireToken(token)
  return apiRequest<PremiumPaymentMethodRow>(
    `/api/customers/${customerId}/premium-payments/${paymentId}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    },
  )
}

export async function disableCustomerPremiumPayment(
  token: string,
  customerId: number,
  paymentId: number,
): Promise<PremiumPaymentMethodRow> {
  requireToken(token)
  return apiRequest<PremiumPaymentMethodRow>(
    `/api/customers/${customerId}/premium-payments/${paymentId}/disable`,
    { method: 'POST', token, body: '{}' },
  )
}

export async function enableCustomerPremiumPayment(
  token: string,
  customerId: number,
  paymentId: number,
): Promise<PremiumPaymentMethodRow> {
  requireToken(token)
  return apiRequest<PremiumPaymentMethodRow>(
    `/api/customers/${customerId}/premium-payments/${paymentId}/enable`,
    { method: 'POST', token, body: '{}' },
  )
}

export async function reauthenticatePremiumPaymentCard(
  token: string,
  customerId: number,
  paymentId: number,
  password: string,
): Promise<PremiumPaymentReauthResponse> {
  requireToken(token)
  return apiRequest<PremiumPaymentReauthResponse>(
    `/api/customers/${customerId}/premium-payments/${paymentId}/reauthenticate`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ password }),
    },
  )
}

export async function revealPremiumPaymentCardNumber(
  token: string,
  customerId: number,
  paymentId: number,
  reauthToken: string,
): Promise<PremiumPaymentRevealResponse> {
  requireToken(token)
  return apiRequest<PremiumPaymentRevealResponse>(
    `/api/customers/${customerId}/premium-payments/${paymentId}/reveal-card-number`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ reauthToken }),
    },
  )
}

export async function listPremiumPaymentsOverview(
  token: string,
  opts?: { q?: string; isActive?: boolean | null; limit?: number; offset?: number },
): Promise<{ premiumPayments: PremiumPaymentMethodRow[]; total: number }> {
  requireToken(token)
  const params = new URLSearchParams()
  if (opts?.q?.trim()) {
    params.set('q', opts.q.trim())
  }
  if (opts?.isActive === true) {
    params.set('isActive', 'true')
  } else if (opts?.isActive === false) {
    params.set('isActive', 'false')
  }
  if (opts?.limit != null) {
    params.set('limit', String(opts.limit))
  }
  if (opts?.offset != null) {
    params.set('offset', String(opts.offset))
  }
  const qs = params.toString()
  return apiRequest<{ premiumPayments: PremiumPaymentMethodRow[]; total: number }>(
    `/api/premium-payments${qs ? `?${qs}` : ''}`,
    { token },
  )
}

export function formatCardExpiry(month: number, year: number): string {
  const mm = String(month).padStart(2, '0')
  const yy = String(year).slice(-2)
  return `${mm}/${yy}`
}
