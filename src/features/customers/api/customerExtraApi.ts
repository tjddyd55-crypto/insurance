import { ApiError, apiRequest } from '../../../lib/apiClient'

export type CustomerConsultationRow = {
  id: number
  customerId: number
  userId: string
  gaId: number
  body: string
  createdAt: string
}

export type CustomerRelationRow = {
  relatedCustomerId: number
  relatedName: string
  relatedPhone: string
  createdAt: string
}

export async function listCustomerConsultations(
  token: string,
  customerId: number,
): Promise<CustomerConsultationRow[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<CustomerConsultationRow[]>(`/api/customers/${customerId}/consultations`, {
    token,
  })
}

export async function createCustomerConsultation(
  token: string,
  customerId: number,
  body: string,
): Promise<CustomerConsultationRow> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<CustomerConsultationRow>(`/api/customers/${customerId}/consultations`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  })
}

export async function listCustomerRelations(
  token: string,
  customerId: number,
): Promise<CustomerRelationRow[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<CustomerRelationRow[]>(`/api/customers/${customerId}/relations`, { token })
}

export async function createCustomerRelation(
  token: string,
  customerId: number,
  relatedCustomerId: number,
): Promise<{ ok: boolean; customerId: number; relatedCustomerId: number }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean; customerId: number; relatedCustomerId: number }>(
    `/api/customers/${customerId}/relations`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ relatedCustomerId }),
    },
  )
}
