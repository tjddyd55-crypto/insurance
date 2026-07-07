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
  params.set('includeBlocked', 'false')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export { buildSearchQuery }

export function dedupeSmsSearchCustomersByCustomerId(
  customers: SmsBulkSearchCustomer[],
): SmsBulkSearchCustomer[] {
  const seen = new Set<number>()
  const deduped: SmsBulkSearchCustomer[] = []
  for (const row of customers) {
    if (seen.has(row.customerId)) {
      continue
    }
    seen.add(row.customerId)
    deduped.push(row)
  }
  return deduped
}

export async function searchSmsBulkRecipients(
  token: string,
  filters: SmsBulkRecipientFilters,
): Promise<{ customers: SmsBulkSearchCustomer[]; totalCount: number }> {
  const raw = await apiRequest<{ customers: SmsBulkSearchCustomer[]; totalCount: number }>(
    `/api/sms/recipients/customers${buildSearchQuery(filters)}`,
    { token: requireSmsToken(token) },
  )
  const sendable = Array.isArray(raw?.customers) ? raw.customers.filter((row) => row.canSend) : []
  const customers = dedupeSmsSearchCustomersByCustomerId(sendable)
  return {
    customers,
    totalCount: customers.length,
  }
}
