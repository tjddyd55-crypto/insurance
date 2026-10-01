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

export async function fetchServiceIntegrations(token: string): Promise<ServiceIntegrationCard[]> {
  const raw = await apiRequest<{ success: boolean; data: { providers: ServiceIntegrationCard[] } }>(
    '/api/service-integrations',
    { token },
  )
  return raw.data?.providers ?? []
}

export async function connectServiceIntegration(token: string, providerKey: string): Promise<{ path?: string }> {
  const raw = await apiRequest<{ success: boolean; data?: { path?: string } }>(
    `/api/service-integrations/${encodeURIComponent(providerKey)}/connect`,
    { token, method: 'POST', body: JSON.stringify({}) },
  )
  return raw.data ?? {}
}

export async function disconnectServiceIntegration(token: string, providerKey: string): Promise<void> {
  await apiRequest(`/api/service-integrations/${encodeURIComponent(providerKey)}/disconnect`, {
    token,
    method: 'POST',
    body: JSON.stringify({}),
  })
}
