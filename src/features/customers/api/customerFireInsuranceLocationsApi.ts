import { ApiError, apiRequest } from '../../../lib/apiClient'

export type CustomerFireInsuranceLocationRecord = {
  id: number
  customerId: number
  address: string
  memo: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CustomerFireInsuranceLocationInput = {
  address: string
  memo?: string
}

function assertToken(token: string): void {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
}

function mapLocation(raw: Record<string, unknown>): CustomerFireInsuranceLocationRecord {
  return {
    id: Number(raw.id),
    customerId: Number(raw.customerId),
    address: String(raw.address ?? ''),
    memo: String(raw.memo ?? ''),
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

export async function listCustomerFireInsuranceLocations(
  token: string,
  customerId: number,
): Promise<CustomerFireInsuranceLocationRecord[]> {
  assertToken(token)
  if (!Number.isInteger(customerId) || customerId < 1) {
    throw new ApiError('고객 id가 유효하지 않습니다.', 400)
  }
  const raw = await apiRequest<unknown>(`/api/customers/${customerId}/fire-insurance-locations`, {
    method: 'GET',
    token,
  })
  if (!raw || typeof raw !== 'object') {
    return []
  }
  const locations = (raw as { fireInsuranceLocations?: unknown }).fireInsuranceLocations
  if (!Array.isArray(locations)) {
    return []
  }
  return locations
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map(mapLocation)
}

export async function createCustomerFireInsuranceLocation(
  token: string,
  customerId: number,
  input: CustomerFireInsuranceLocationInput,
): Promise<CustomerFireInsuranceLocationRecord> {
  assertToken(token)
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/customers/${customerId}/fire-insurance-locations`,
    { method: 'POST', token, body: JSON.stringify(input) },
  )
  return mapLocation(raw)
}

export async function updateCustomerFireInsuranceLocation(
  token: string,
  customerId: number,
  locationId: number,
  input: CustomerFireInsuranceLocationInput,
): Promise<CustomerFireInsuranceLocationRecord> {
  assertToken(token)
  const raw = await apiRequest<Record<string, unknown>>(
    `/api/customers/${customerId}/fire-insurance-locations/${locationId}`,
    { method: 'PATCH', token, body: JSON.stringify(input) },
  )
  return mapLocation(raw)
}

export async function deleteCustomerFireInsuranceLocation(
  token: string,
  customerId: number,
  locationId: number,
): Promise<void> {
  assertToken(token)
  await apiRequest(`/api/customers/${customerId}/fire-insurance-locations/${locationId}`, {
    method: 'DELETE',
    token,
  })
}
