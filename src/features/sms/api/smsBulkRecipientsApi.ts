import { apiRequest } from '../../../lib/apiClient'
import type { SmsBulkRecipientFilters, SmsBulkSearchCustomer } from '../types/smsBulkRecipient.types'

function requireSmsToken(token: string): string {
  if (!token?.trim()) {
    throw new Error('로그인이 필요합니다.')
  }
  return token.trim()
}

function buildSearchQuery(filters: SmsBulkRecipientFilters): string {
  const params = new URLSearchParams()
  if (filters.search.trim()) {
    params.set('search', filters.search.trim())
  }
  if (filters.gender === 'male' || filters.gender === 'female') {
    params.set('gender', filters.gender)
  }
  if (filters.sangnyeongDays.trim()) {
    params.set('sangnyeongDays', filters.sangnyeongDays.trim())
  }
  if (filters.insuranceAgeFrom.trim()) {
    params.set('insuranceAgeFrom', filters.insuranceAgeFrom.trim())
  }
  if (filters.insuranceAgeTo.trim()) {
    params.set('insuranceAgeTo', filters.insuranceAgeTo.trim())
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function searchSmsBulkRecipients(
  token: string,
  filters: SmsBulkRecipientFilters,
): Promise<{ customers: SmsBulkSearchCustomer[]; totalCount: number }> {
  const raw = await apiRequest<{ customers: SmsBulkSearchCustomer[]; totalCount: number }>(
    `/api/sms/recipients/customers${buildSearchQuery(filters)}`,
    { token: requireSmsToken(token) },
  )
  return {
    customers: Array.isArray(raw?.customers) ? raw.customers : [],
    totalCount: Number(raw?.totalCount ?? 0),
  }
}
