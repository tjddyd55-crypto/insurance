import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { CustomerSpecialDatePurposeType } from '../types/customerSpecialDateForm'

export type CustomerSpecialDateRecord = {
  id: number
  customerId: number
  purposeType: CustomerSpecialDatePurposeType
  title: string
  dateValue: string
  memo: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CustomerSpecialDateInput = {
  purposeType: CustomerSpecialDatePurposeType
  title: string
  dateValue: string
  memo?: string
}

function assertToken(token: string): void {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
}

function mapSpecialDate(raw: Record<string, unknown>): CustomerSpecialDateRecord {
  const purpose = String(raw.purposeType ?? 'CELEBRATION').trim().toUpperCase()
  return {
    id: Number(raw.id),
    customerId: Number(raw.customerId),
    purposeType: purpose as CustomerSpecialDatePurposeType,
    title: String(raw.title ?? ''),
    dateValue: raw.dateValue == null || raw.dateValue === '' ? '' : String(raw.dateValue).slice(0, 10),
    memo: String(raw.memo ?? ''),
    sortOrder: Number(raw.sortOrder ?? 0),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

export async function listCustomerSpecialDates(
  token: string,
  customerId: number,
): Promise<CustomerSpecialDateRecord[]> {
  assertToken(token)
  if (!Number.isInteger(customerId) || customerId < 1) {
    throw new ApiError('고객 id가 유효하지 않습니다.', 400)
  }
  const raw = await apiRequest<unknown>(`/api/customers/${customerId}/special-dates`, {
    method: 'GET',
    token,
  })
  if (!raw || typeof raw !== 'object') {
    return []
  }
  const specialDates = (raw as { specialDates?: unknown }).specialDates
  if (!Array.isArray(specialDates)) {
    return []
  }
  return specialDates.map((row) => mapSpecialDate(row as Record<string, unknown>))
}

export async function createCustomerSpecialDate(
  token: string,
  customerId: number,
  payload: CustomerSpecialDateInput,
): Promise<CustomerSpecialDateRecord> {
  assertToken(token)
  const raw = await apiRequest<unknown>(`/api/customers/${customerId}/special-dates`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('기념일 등록 응답이 올바르지 않습니다.', 502)
  }
  return mapSpecialDate(raw as Record<string, unknown>)
}

export async function updateCustomerSpecialDate(
  token: string,
  customerId: number,
  specialDateId: number,
  payload: Partial<CustomerSpecialDateInput>,
): Promise<CustomerSpecialDateRecord> {
  assertToken(token)
  const raw = await apiRequest<unknown>(`/api/customers/${customerId}/special-dates/${specialDateId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('기념일 수정 응답이 올바르지 않습니다.', 502)
  }
  return mapSpecialDate(raw as Record<string, unknown>)
}

export async function deleteCustomerSpecialDate(
  token: string,
  customerId: number,
  specialDateId: number,
): Promise<void> {
  assertToken(token)
  await apiRequest<unknown>(`/api/customers/${customerId}/special-dates/${specialDateId}`, {
    method: 'DELETE',
    token,
  })
}
