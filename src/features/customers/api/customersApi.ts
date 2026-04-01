import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { CustomerRecord } from '../domain/types'

export async function searchCustomers(token: string, q: string): Promise<CustomerRecord[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const query = new URLSearchParams()
  if (q.trim()) {
    query.set('q', q.trim())
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return apiRequest<CustomerRecord[]>(`/api/customers/search${suffix}`, { token })
}

export interface SaveCustomerPayload {
  name: string
  ssn?: string
  phone?: string
  carrier?: string
  address?: string
  height?: string
  weight?: string
  job?: string
  driving?: string
  medical?: string
}

export async function saveCustomer(
  token: string,
  payload: SaveCustomerPayload,
): Promise<CustomerRecord> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const body = await apiRequest<{ success: boolean; data: CustomerRecord }>('/api/customers', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
  return body.data
}
