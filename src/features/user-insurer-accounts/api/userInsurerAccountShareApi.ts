import { ApiError, apiRequest } from '../../../lib/apiClient'
import { getPublicOrigin } from '../../../lib/publicOrigin'

export type UserInsurerAccountShareLinkResponse = {
  shareUrl: string | null
  token: string | null
  ownerDisplayName: string | null
  createdAt?: string
}

export function resolveAccountVaultSharePageUrl(
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

  const shareToken = String(token ?? '').trim()
  if (!shareToken) {
    return null
  }

  const origin = getPublicOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
  const path = `/share/account-credentials/${encodeURIComponent(shareToken)}`
  if (!origin || origin === 'null') {
    return path
  }
  return `${origin.replace(/\/$/, '')}${path}`
}

export async function fetchUserInsurerAccountShareLink(
  authToken: string,
): Promise<UserInsurerAccountShareLinkResponse> {
  if (!authToken.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<UserInsurerAccountShareLinkResponse>('/api/user-insurer-accounts/share-link', {
    token: authToken,
  })
}

export async function createUserInsurerAccountShareLink(
  authToken: string,
): Promise<UserInsurerAccountShareLinkResponse> {
  if (!authToken.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<UserInsurerAccountShareLinkResponse>('/api/user-insurer-accounts/share-link', {
    method: 'POST',
    token: authToken,
    body: JSON.stringify({}),
  })
}
