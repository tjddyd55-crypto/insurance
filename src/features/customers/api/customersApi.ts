import type { InsuranceApplicationRecord } from '../../application/domain/types'
import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { CustomerNote, CustomerNotesBag, CustomerRecord } from '../domain/types'

export type ListCustomersResult = {
  customers: CustomerRecord[]
  /** 삭제 제외, 동일 user·GA 스코프의 DB 전체 건수 */
  total: number
}

/** id가 있는 행만 유지해 렌더 단계의 undefined.id 크래시를 막는다 */
function filterValidCustomerRows(raw: unknown[]): CustomerRecord[] {
  const out: CustomerRecord[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue
    }
    const id = (row as { id?: unknown }).id
    if (typeof id !== 'number' || !Number.isFinite(id)) {
      continue
    }
    out.push(row as CustomerRecord)
  }
  return out
}

function assertCustomerDataRecord(data: unknown, context: string): CustomerRecord {
  if (!data || typeof data !== 'object') {
    throw new ApiError(`${context}: 응답 data가 없습니다.`, 500)
  }
  const id = (data as { id?: unknown }).id
  if (typeof id !== 'number' || !Number.isFinite(id)) {
    throw new ApiError(`${context}: 고객 id가 응답에 없습니다.`, 500)
  }
  return data as CustomerRecord
}

export async function listCustomers(token: string, limit = 500): Promise<ListCustomersResult> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : ''
  const body = await apiRequest<{ data?: unknown; total?: unknown } | unknown[]>(`/api/customers${query}`, { token })

  let rawRows: unknown[]
  let totalFromBody: number | undefined

  if (Array.isArray(body)) {
    rawRows = body
  } else {
    if (!body || typeof body !== 'object') {
      throw new ApiError('customers 응답 구조 오류입니다.', 500)
    }
    const data = (body as { data?: unknown }).data
    if (!Array.isArray(data)) {
      throw new ApiError('customers 응답 구조 오류: data가 배열이 아닙니다.', 500)
    }
    rawRows = data
    const t = (body as { total?: unknown }).total
    totalFromBody = typeof t === 'number' && Number.isFinite(t) ? t : undefined
  }

  const customers = filterValidCustomerRows(rawRows)
  if (import.meta.env.DEV) {
    if (customers.length !== rawRows.length) {
      console.warn('[listCustomers] 유효하지 않은 행 제거:', rawRows.length - customers.length)
    }
    console.log('[listCustomers] refreshed customers:', customers)
  }

  const total =
    totalFromBody != null && Number.isFinite(totalFromBody)
      ? totalFromBody
      : customers.length

  return { customers, total }
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
  try {
    return await apiRequest<CustomerRecord[]>(`/api/customers/search${suffix}`, { token })
  } catch {
    return []
  }
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
  const body = await apiRequest<{ success?: boolean; data?: unknown }>(`/api/customers/${customerId}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(payload),
  })
  return assertCustomerDataRecord(body?.data, '고객 수정')
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
  const body = await apiRequest<{ success?: boolean; data?: unknown }>('/api/customers', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
  return assertCustomerDataRecord(body?.data, '고객 등록')
}

/** 로그인 없이 ref(담당자 user id) 계정으로 고객 저장 (외부 입력 전용) */
export async function saveCustomerExternal(
  refUserId: string,
  payload: SaveCustomerPayload,
): Promise<CustomerRecord> {
  // 반드시 POST /api/customer/external-create 로 전송 (resolveApiUrl이 절대/상대 베이스 모두 처리)
  const body = await apiRequest<{ success?: boolean; data?: unknown }>('/api/customer/external-create', {
    method: 'POST',
    body: JSON.stringify({ refUserId, ...payload }),
  })
  return assertCustomerDataRecord(body?.data, '외부 고객 등록')
}
