import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { UserInsurerAccountCategory } from '../config/userInsurerAccounts.config'
import type { UserInsurerAccountRow } from './userInsurerAccountsApi'

/** 목록에는 이름만 노출한다. userId 는 이동/호출용 내부 식별자. */
export type SharedAccountUser = {
  userId: string
  name: string
}

function requireToken(token: string): string {
  const t = token.trim()
  if (!t) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return t
}

/** 내 계정관리 공유 상태 조회 */
export async function fetchAccountShareVisibility(token: string): Promise<boolean> {
  const t = requireToken(token)
  const { enabled } = await apiRequest<{ enabled: boolean }>(
    '/api/user-insurer-accounts/share-visibility',
    { token: t },
  )
  return Boolean(enabled)
}

/** 내 계정관리 공유 상태 변경 */
export async function updateAccountShareVisibility(token: string, enabled: boolean): Promise<boolean> {
  const t = requireToken(token)
  const result = await apiRequest<{ enabled: boolean }>('/api/user-insurer-accounts/share-visibility', {
    method: 'PATCH',
    token: t,
    body: JSON.stringify({ enabled }),
  })
  return Boolean(result.enabled)
}

/** 같은 GA 에서 공유 ON 인 사용자 목록(이름만) */
export async function fetchSharedAccountUsers(token: string): Promise<SharedAccountUser[]> {
  const t = requireToken(token)
  const { data } = await apiRequest<{ success: boolean; data: SharedAccountUser[] }>(
    '/api/user-insurer-accounts/shared-users',
    { token: t },
  )
  return Array.isArray(data) ? data : []
}

function sharedAccountsPath(userId: string): string {
  return `/api/user-insurer-accounts/shared-users/${encodeURIComponent(userId)}/accounts`
}

export async function fetchSharedUserAccounts(
  token: string,
  userId: string,
): Promise<{ accounts: UserInsurerAccountRow[]; ownerDisplayName: string }> {
  const t = requireToken(token)
  const { accounts, ownerDisplayName } = await apiRequest<{
    accounts: UserInsurerAccountRow[]
    ownerDisplayName: string
  }>(sharedAccountsPath(userId), { token: t })
  return { accounts, ownerDisplayName: ownerDisplayName ?? '' }
}

export async function createSharedUserAccount(
  token: string,
  userId: string,
  payload: {
    category: UserInsurerAccountCategory
    companyName: string
    loginId?: string
    loginPassword?: string
    memo?: string
  },
): Promise<UserInsurerAccountRow> {
  const t = requireToken(token)
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>(sharedAccountsPath(userId), {
    method: 'POST',
    token: t,
    body: JSON.stringify(payload),
  })
  return account
}

export async function patchSharedUserAccount(
  token: string,
  userId: string,
  id: string,
  payload: Partial<{ companyName: string; loginId: string; loginPassword: string; memo: string }>,
): Promise<UserInsurerAccountRow> {
  const t = requireToken(token)
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>(
    `${sharedAccountsPath(userId)}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      token: t,
      body: JSON.stringify(payload),
    },
  )
  return account
}

export async function deleteSharedUserAccount(token: string, userId: string, id: string): Promise<void> {
  const t = requireToken(token)
  await apiRequest<{ ok: boolean }>(`${sharedAccountsPath(userId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token: t,
  })
}
