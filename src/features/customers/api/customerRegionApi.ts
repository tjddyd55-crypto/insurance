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
  const raw = await apiRequest<{ success: boolean; data: CustomerRegionOptions }>(
    `/api/customers/regions/options${suffix ? `?${suffix}` : ''}`,
    { token },
  )
  return raw.data ?? { sido: [], sigungu: [], eupmyeondong: [] }
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
  const raw = await apiRequest<{ success: boolean; data: { customers: CustomerRegionRow[] } }>(
    `/api/customers/regions?${params.toString()}`,
    { token },
  )
  return raw.data?.customers ?? []
}
