import { apiRequest } from '../../../lib/apiClient'

export type ServiceIntegrationStatus = 'connected' | 'disconnected' | 'error' | 'needs_reauth' | 'unconfigured'

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
  /** Google 처럼 계정을 연결한 시각. 없으면 null */
  connectedAt?: string | null
  settingsPath: string | null
  /** Google 카드만: 한 연결로 쓰는 제품별 상태(읽기 전용) */
  products?: GoogleProductsState
  /** Google 카드만: 저장된 동의에 tasks.readonly 가 없어 다시 연결이 필요 */
  needsReconsent?: boolean
}

export type GoogleProductStatus = 'available' | 'scope_missing' | 'unconfigured' | 'disconnected' | 'needs_reauth' | 'error'

export type GoogleProductsState = {
  calendar: { status: GoogleProductStatus; scopeGranted: boolean; readOnly: boolean }
  tasks: { status: GoogleProductStatus; scopeGranted: boolean; needsReconsent: boolean; readOnly: boolean }
}

export const SERVICE_INTEGRATION_STATUS_LABEL: Record<ServiceIntegrationStatus, string> = {
  connected: '연동됨',
  disconnected: '미연동',
  error: '오류',
  needs_reauth: '재연결 필요',
  unconfigured: '미설정',
}

/** Google OAuth callback 이 붙여 돌려보내는 reason → 사용자 문구 */
export const GOOGLE_CONNECT_ERROR_MESSAGE: Record<string, string> = {
  access_denied: 'Google 동의가 취소되어 연결하지 않았습니다.',
  state_invalid: '연결 요청이 유효하지 않습니다. 서비스 연동에서 다시 시도해 주세요.',
  state_expired: '연결 요청 시간이 지났습니다. 다시 시도해 주세요.',
  session_mismatch: '연결을 시작한 브라우저와 다른 곳에서 완료되어 연결하지 않았습니다. 이 화면에서 다시 시도해 주세요.',
  scope_missing: 'Google Calendar 읽기 권한이 허용되지 않았습니다. 다시 연결할 때 Calendar 권한을 허용해 주세요.',
  refresh_token_missing: 'Google 연결 정보를 받지 못했습니다. 다시 연결해 주세요.',
  unconfigured: 'Google 연동 설정이 아직 없습니다. 관리자에게 문의해 주세요.',
}

export function googleConnectErrorMessage(reason: string | null | undefined): string {
  return GOOGLE_CONNECT_ERROR_MESSAGE[String(reason ?? '')] ?? 'Google 계정을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
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

export function readServiceIntegrationConnectResult(payload: unknown): { path?: string; url?: string } {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  const body = payload as { path?: unknown; url?: unknown; data?: unknown }
  const nested = body.data && typeof body.data === 'object' ? (body.data as { path?: unknown; url?: unknown }) : {}
  const pick = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)
  const path = pick(body.path) ?? pick(nested.path)
  const url = pick(body.url) ?? pick(nested.url)
  return {
    ...(path ? { path } : {}),
    ...(url && isGoogleAuthorizationUrl(url) ? { url } : {}),
  }
}

/** 서버가 준 OAuth 이동 주소는 Google 동의 화면일 때만 따른다. */
export function isGoogleAuthorizationUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname === 'accounts.google.com'
  } catch {
    return false
  }
}

export async function fetchServiceIntegrations(token: string): Promise<ServiceIntegrationCard[]> {
  const raw = await apiRequest<unknown>('/api/service-integrations', { token })
  return readServiceIntegrationProviders(raw)
}

export async function connectServiceIntegration(token: string, providerKey: string): Promise<{ path?: string; url?: string }> {
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
