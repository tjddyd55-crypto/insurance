import { apiRequest } from '../../lib/apiClient'
export function healthwayApi<T>(path: string, token?: string | null, body?: object): Promise<T> {
  return apiRequest<T>(`/api/healthway${path}`, { token, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) })
}
