import { apiRequest } from '../../../lib/apiClient'

export type ServiceIntegrationStatus = 'connected' | 'disconnected' | 'error' | 'unconfigured'

export type ServiceIntegrationCard = {
  key: string
  group: string
  groupLabel: string
  name: string
  description: string
  kind: string
  availability: 'ready' | 'unconfigured'
  status: ServiceIntegrationStatus
  lastSyncedAt: string | null
  lastError: string | null
  secretMasked: string | null
  sender: string
  accountLabel: string
  settingsPath: string | null
}

export const SERVICE_INTEGRATION_STATUS_LABEL: Record<ServiceIntegrationStatus, string> = {
  connected: '연동됨',
  disconnected: '미연동',
  error: '오류',
  unconfigured: '미설정',
}

function isProviderList(value: unknown): value is ServiceIntegrationCard[] {
  return Array.isArray(value)
}

/**
 * `apiRequest`는 `{ success, data }`를 `data`로 푼다.
 * 봉투와 풀린 본문 둘 다에서 providers를 읽는다. 둘 다 없으면 빈 배열.
 */
export function readServiceIntegrationProviders(payload: unknown): ServiceIntegrationCard[] {
  if (isProviderList(payload)) {
    return payload
  }
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const body = payload as { providers?: unknown; data?: unknown }
  if (isProviderList(body.providers)) {
    return body.providers
  }
  if (body.data && typeof body.data === 'object') {
    const nested = body.data as { providers?: unknown }
    if (isProviderList(nested.providers)) {
      return nested.providers
    }
  }
  return []
}

export function readServiceIntegrationConnectResult(payload: unknown): { path?: string } {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  const body = payload as { path?: unknown; data?: unknown }
  if (typeof body.path === 'string' && body.path.trim()) {
    return { path: body.path }
  }
  if (body.data && typeof body.data === 'object') {
    const nested = body.data as { path?: unknown }
    if (typeof nested.path === 'string' && nested.path.trim()) {
      return { path: nested.path }
    }
  }
  return {}
}

export async function fetchServiceIntegrations(token: string): Promise<ServiceIntegrationCard[]> {
  const raw = await apiRequest<unknown>('/api/service-integrations', { token })
  return readServiceIntegrationProviders(raw)
}

export async function connectServiceIntegration(token: string, providerKey: string): Promise<{ path?: string }> {
  const raw = await apiRequest<unknown>(
    `/api/service-integrations/${encodeURIComponent(providerKey)}/connect`,
    { token, method: 'POST', body: JSON.stringify({}) },
  )
  return readServiceIntegrationConnectResult(raw)
}

export async function disconnectServiceIntegration(token: string, providerKey: string): Promise<void> {
  await apiRequest(`/api/service-integrations/${encodeURIComponent(providerKey)}/disconnect`, {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  })
}
