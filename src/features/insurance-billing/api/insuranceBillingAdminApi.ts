import { apiRequest } from '../../../lib/apiClient'

export type BillingPromotionCodeAdminRow = {
  id: number
  code: string
  name: string
  type: string
  freeMonths: number | null
  amountOff: number | null
  percentOff: number | null
  isActive: boolean
  usedCount: number
  maxRedemptions: number | null
  perUserLimit: number
  appliesToProduct: string
  appliesToPlanCode: string | null
  applyScope: string
  memo: string | null
  startsAt: string | null
  endsAt: string | null
  deletedAt: string | null
  deletedBy: string | null
  createdAt: string
  updatedAt: string
}

export type BillingPromotionListFilter = 'all' | 'active' | 'inactive' | 'deleted'

export type BillingPromotionCreatePayload = {
  code: string
  name: string
  type: 'free_months' | 'amount_off' | 'percent_off'
  freeMonths?: number
  amountOff?: number
  percentOff?: number
  appliesToProduct: 'insurance'
  appliesToPlanCode: string
  maxRedemptions?: number | null
  applyScope?: string
  memo?: string | null
}

export type BillingPromotionCodeStatsResponse = {
  promotion: BillingPromotionCodeAdminRow
  redemptionCount: number
  accountCount: number
  recentRedemptions: Array<{
    id: number
    userId: string
    redeemedAt: string | null
    freeEndsAt: string | null
  }>
}

export async function createAdminBillingPromotionCode(token: string, body: BillingPromotionCreatePayload) {
  return apiRequest<{ row: BillingPromotionCodeAdminRow }>('/api/admin/billing/promotion-codes', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function updateAdminBillingPromotionCode(
  token: string,
  codeId: number,
  body: BillingPromotionCreatePayload,
) {
  return apiRequest<{ row: BillingPromotionCodeAdminRow }>(`/api/admin/billing/promotion-codes/${codeId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function fetchAdminBillingPromotionCodeStats(token: string, codeId: number) {
  return apiRequest<BillingPromotionCodeStatsResponse>(`/api/admin/billing/promotion-codes/${codeId}/stats`, {
    token,
  })
}

export async function fetchAdminBillingPromotionCodes(token: string, filter: BillingPromotionListFilter = 'all') {
  const query = filter === 'all' ? '' : `?filter=${encodeURIComponent(filter)}`
  return apiRequest<{ rows: BillingPromotionCodeAdminRow[] }>(
    `/api/admin/billing/promotion-codes${query}`,
    { token },
  )
}

export async function activateAdminBillingPromotionCode(token: string, codeId: number) {
  return apiRequest<{ success: boolean }>(`/api/admin/billing/promotion-codes/${codeId}/activate`, {
    method: 'PATCH',
    token,
  })
}

export async function deactivateAdminBillingPromotionCode(token: string, codeId: number) {
  return apiRequest<{ success: boolean }>(`/api/admin/billing/promotion-codes/${codeId}/deactivate`, {
    method: 'PATCH',
    token,
  })
}

export async function deleteAdminBillingPromotionCode(token: string, codeId: number) {
  return apiRequest<{ success: boolean; alreadyDeleted?: boolean }>(
    `/api/admin/billing/promotion-codes/${codeId}`,
    {
      method: 'DELETE',
      token,
    },
  )
}

export type BillingPaymentStatusFilter = 'pending' | 'paid' | 'canceled' | 'failed' | 'all'

export type BillingPaymentAdminItem = {
  paymentId: string
  userId: string
  userName: string
  username: string
  tenantId: number | null
  tenantName: string | null
  subscriptionId: string | null
  planName: string
  planCode: string | null
  billingCycle: string
  amount: number
  vatAmount: number
  totalAmount: number
  status: string
  provider: string
  promotionCode: string | null
  referralCode: string | null
  createdAt: string
  paidAt: string | null
  canceledAt?: string | null
  cancelReason?: string | null
}

export async function fetchAdminBillingPayments(
  token: string,
  query: { status?: BillingPaymentStatusFilter; page?: number; limit?: number; userId?: string; tenantId?: number } = {},
) {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.userId) params.set('userId', query.userId)
  if (query.tenantId) params.set('tenantId', String(query.tenantId))
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiRequest<{ items: BillingPaymentAdminItem[]; page: number; limit: number; total: number }>(
    `/api/admin/billing/payments${suffix}`,
    { token },
  )
}

export async function fetchAdminBillingPaymentDetail(token: string, paymentId: string) {
  return apiRequest<{ item: BillingPaymentAdminItem }>(`/api/admin/billing/payments/${paymentId}`, { token })
}

export async function approveAdminBillingPayment(token: string, paymentId: string) {
  return apiRequest<{ ok: boolean; paymentId: number; subscriptionStatus: string }>(
    `/api/admin/billing/payments/${paymentId}/approve`,
    { method: 'POST', token, body: JSON.stringify({}) },
  )
}

export async function cancelAdminBillingPayment(token: string, paymentId: string, cancelReason?: string) {
  return apiRequest<{ ok: boolean; paymentId: number; status: string }>(
    `/api/admin/billing/payments/${paymentId}/cancel`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(cancelReason ? { cancelReason } : {}),
    },
  )
}
