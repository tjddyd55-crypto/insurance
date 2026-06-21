import { apiRequest } from '../../../lib/apiClient'

export type BillingPromotionCodeAdminRow = {
  id: number
  code: string
  name: string
  type: string
  freeMonths: number | null
  isActive: boolean
  usedCount: number
  maxRedemptions: number | null
  perUserLimit: number
  appliesToProduct: string
  appliesToPlanCode: string | null
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
}

export async function createAdminBillingPromotionCode(token: string, body: BillingPromotionCreatePayload) {
  return apiRequest<{ row: BillingPromotionCodeAdminRow }>('/api/admin/billing/promotion-codes', {
    method: 'POST',
    token,
    body,
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
