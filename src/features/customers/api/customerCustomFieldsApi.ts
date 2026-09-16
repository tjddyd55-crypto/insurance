import { ApiError, apiRequest } from '../../../lib/apiClient'

export type CustomerCustomFieldRecord = {
  id: number
  customerId: number
  label: string
  value: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CustomerCustomFieldInput = {
  label: string
  value: string
  sortOrder?: number
}

function assertToken(token: string): void {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
}

function mapCustomField(raw: Record<string, unknown>): CustomerCustomFieldRecord {
  return {
    id: Number(raw.id),
    customerId: Number(raw.customerId),
    label: String(raw.label ?? ''),
    value: String(raw.value ?? ''),
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

export async function listCustomerCustomFields(
  token: string,
  customerId: number,
): Promise<CustomerCustomFieldRecord[]> {
  assertToken(token)
  if (!Number.isInteger(customerId) || customerId < 1) {
    throw new ApiError('고객 id가 유효하지 않습니다.', 400)
  }
  const raw = await apiRequest<unknown>(`/api/customers/${customerId}/custom-fields`, {
    method: 'GET',
    token,
  })
  if (!raw || typeof raw !== 'object') {
    return []
  }
  const customFields = (raw as { customFields?: unknown }).customFields
  if (!Array.isArray(customFields)) {
    return []
  }
  return customFields.map((row) => mapCustomField(row as Record<string, unknown>))
}

export async function createCustomerCustomField(
  token: string,
  customerId: number,
  payload: CustomerCustomFieldInput,
): Promise<CustomerCustomFieldRecord> {
  assertToken(token)
  const raw = await apiRequest<unknown>(`/api/customers/${customerId}/custom-fields`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('추가 정보 등록 응답이 올바르지 않습니다.', 502)
  }
  return mapCustomField(raw as Record<string, unknown>)
}

export async function updateCustomerCustomField(
  token: string,
  customerId: number,
  customFieldId: number,
  payload: Partial<CustomerCustomFieldInput>,
): Promise<CustomerCustomFieldRecord> {
  assertToken(token)
  const raw = await apiRequest<unknown>(
    `/api/customers/${customerId}/custom-fields/${customFieldId}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    },
  )
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('추가 정보 수정 응답이 올바르지 않습니다.', 502)
  }
  return mapCustomField(raw as Record<string, unknown>)
}

export async function deleteCustomerCustomField(
  token: string,
  customerId: number,
  customFieldId: number,
): Promise<void> {
  assertToken(token)
  await apiRequest<unknown>(`/api/customers/${customerId}/custom-fields/${customFieldId}`, {
    method: 'DELETE',
    token,
  })
}
