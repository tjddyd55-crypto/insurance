import { apiRequest } from '../../../lib/apiClient'

export type CustomerRegionOptions = {
  sido: string[]
  sigungu: string[]
  eupmyeondong: string[]
}

export type CustomerRegionRow = {
  id: number
  name: string
  phone: string
  address: string
  assigneeName: string
  labels: string
}

export type CustomerRegionSort = 'name' | 'created' | 'consult'

const EMPTY_REGION_OPTIONS: CustomerRegionOptions = { sido: [], sigungu: [], eupmyeondong: [] }

/**
 * `apiRequest`는 `{ success, data }`를 `data`로 푼다.
 * 풀린 옵션과 봉투의 `data` 둘 다 읽는다.
 */
export function readCustomerRegionOptions(payload: unknown): CustomerRegionOptions {
  if (!payload || typeof payload !== 'object') {
    return EMPTY_REGION_OPTIONS
  }
  const body = payload as Partial<CustomerRegionOptions> & { data?: unknown }
  if ('sido' in body || 'sigungu' in body || 'eupmyeondong' in body) {
    return {
      sido: Array.isArray(body.sido) ? body.sido : [],
      sigungu: Array.isArray(body.sigungu) ? body.sigungu : [],
      eupmyeondong: Array.isArray(body.eupmyeondong) ? body.eupmyeondong : [],
    }
  }
  if (body.data !== undefined) {
    return readCustomerRegionOptions(body.data)
  }
  return EMPTY_REGION_OPTIONS
}

/** 풀린 `{ customers }`와 봉투 `{ data: { customers } }` 둘 다 읽는다. */
export function readCustomerRegionCustomers(payload: unknown): CustomerRegionRow[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const body = payload as { customers?: unknown; data?: unknown }
  if (Array.isArray(body.customers)) {
    return body.customers as CustomerRegionRow[]
  }
  if (body.data !== undefined) {
    return readCustomerRegionCustomers(body.data)
  }
  return []
}

export async function fetchCustomerRegionOptions(
  token: string,
  query: { sido?: string; sigungu?: string },
): Promise<CustomerRegionOptions> {
  const params = new URLSearchParams()
  if (query.sido) {
    params.set('sido', query.sido)
  }
  if (query.sigungu) {
    params.set('sigungu', query.sigungu)
  }
  const suffix = params.toString()
  const raw = await apiRequest<unknown>(
    `/api/customers/regions/options${suffix ? `?${suffix}` : ''}`,
    { token },
  )
  return readCustomerRegionOptions(raw)
}

export async function fetchCustomerRegionList(
  token: string,
  query: {
    sido?: string
    sigungu?: string
    eupmyeondong?: string
    q?: string
    sort?: CustomerRegionSort
  },
): Promise<CustomerRegionRow[]> {
  const params = new URLSearchParams()
  if (query.sido) params.set('sido', query.sido)
  if (query.sigungu) params.set('sigungu', query.sigungu)
  if (query.eupmyeondong) params.set('eupmyeondong', query.eupmyeondong)
  if (query.q) params.set('q', query.q)
  if (query.sort) params.set('sort', query.sort)
  const raw = await apiRequest<unknown>(`/api/customers/regions?${params.toString()}`, { token })
  return readCustomerRegionCustomers(raw)
}
