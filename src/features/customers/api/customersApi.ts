import type { InsuranceApplicationRecord } from '../../application/domain/types'
import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { CustomerNote, CustomerNotesBag, CustomerRecord } from '../domain/types'

export async function listCustomers(token: string, limit = 500): Promise<CustomerRecord[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : ''
  return apiRequest<CustomerRecord[]>(`/api/customers${query}`, { token })
}

export async function listCustomerForms(
  token: string,
  customerId: number,
): Promise<InsuranceApplicationRecord[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<InsuranceApplicationRecord[]>(`/api/customers/${customerId}/forms`, { token })
}

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
  gender?: 'male' | 'female' | '' | null
  isDriver?: boolean | null
  carType?: string
  /** 레거시: 배열만 보내면 서버가 { items, insuranceHistory: '' }로 저장 */
  notes?: CustomerNote[] | CustomerNotesBag
  phone?: string
  carrier?: string
  address?: string
  height?: string
  weight?: string
  job?: string
  driving?: string
  medical?: string
  /** 등록 시 차량(고객 테이블 car_* 컬럼) — 선택 입력 */
  carNumber?: string
  carModel?: string
  carYear?: string
  renewalDate?: string
}

export interface UpdateCustomerCarPayload {
  carNumber: string
  carModel: string
  carYear: string
  renewalDate: string
}

/** 프로필·차량 필드 중 전달한 키만 서버에서 갱신 */
export type UpdateCustomerPayload = Partial<SaveCustomerPayload> & Partial<UpdateCustomerCarPayload>

export async function updateCustomer(
  token: string,
  customerId: number,
  payload: UpdateCustomerPayload,
): Promise<CustomerRecord> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const body = await apiRequest<{ success: boolean; data: CustomerRecord }>(`/api/customers/${customerId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
  return body.data
}

export async function updateCustomerCar(
  token: string,
  customerId: number,
  payload: UpdateCustomerCarPayload,
): Promise<CustomerRecord> {
  return updateCustomer(token, customerId, {
    carNumber: payload.carNumber,
    carModel: payload.carModel,
    carYear: payload.carYear,
    renewalDate: payload.renewalDate,
  })
}

export async function deleteCustomer(token: string, customerId: number): Promise<void> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  await apiRequest<{ success: boolean }>(`/api/customers/${customerId}`, {
    method: 'DELETE',
    token,
  })
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

/** 로그인 없이 ref(담당자 user id) 계정으로 고객 저장 (외부 입력 전용) */
export async function saveCustomerExternal(
  refUserId: string,
  payload: SaveCustomerPayload,
): Promise<CustomerRecord> {
  // 반드시 POST /api/customer/external-create 로 전송 (resolveApiUrl이 절대/상대 베이스 모두 처리)
  const body = await apiRequest<{ success: boolean; data: CustomerRecord }>('/api/customer/external-create', {
    method: 'POST',
    body: JSON.stringify({ refUserId, ...payload }),
  })
  return body.data
}
