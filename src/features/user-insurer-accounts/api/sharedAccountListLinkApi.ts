import { ApiError, apiRequest } from '../../../lib/apiClient'
import { getPublicOrigin } from '../../../lib/publicOrigin'

export type SharedAccountListLinkResponse = {
  shareUrl: string | null
  token: string | null
  createdAt?: string | null
}

export function resolveSharedAccountListPageUrl(
  shareUrl: string | null | undefined,
  token: string | null | undefined,
): string | null {
  const fromApi = String(shareUrl ?? '').trim()
  if (fromApi) {
    if (/^https?:\/\//i.test(fromApi)) {
      return fromApi
    }
    const origin = getPublicOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
    if (origin) {
      return new URL(fromApi, origin).href
    }
    return fromApi
  }

  const listToken = String(token ?? '').trim()
  if (!listToken) {
    return null
  }

  const origin = getPublicOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
  const path = `/share/account-credentials/shared/${encodeURIComponent(listToken)}`
  if (!origin || origin === 'null') {
    return path
  }
  return `${origin.replace(/\/$/, '')}${path}`
}

export function publicSharedAccountVaultDetailPath(listToken: string, userId: string): string {
  return `/share/account-credentials/shared/${encodeURIComponent(listToken)}/${encodeURIComponent(userId)}`
}

export async function fetchSharedAccountListLink(authToken: string): Promise<SharedAccountListLinkResponse> {
  if (!authToken.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<SharedAccountListLinkResponse>('/api/user-insurer-accounts/shared-list-link', {
    token: authToken,
  })
}

export async function createSharedAccountListLink(authToken: string): Promise<SharedAccountListLinkResponse> {
  if (!authToken.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<SharedAccountListLinkResponse>('/api/user-insurer-accounts/shared-list-link', {
    method: 'POST',
    token: authToken,
    body: JSON.stringify({}),
  })
}

export async function regenerateSharedAccountListLink(
  authToken: string,
): Promise<SharedAccountListLinkResponse> {
  if (!authToken.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<SharedAccountListLinkResponse>(
    '/api/user-insurer-accounts/shared-list-link/regenerate',
    {
      method: 'POST',
      token: authToken,
      body: JSON.stringify({}),
    },
  )
}
