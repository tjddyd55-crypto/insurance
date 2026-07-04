import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { UserInsurerAccountCategory } from '../config/userInsurerAccounts.config'
import type { SharedAccountUser } from './accountShareVisibilityApi'
import type { UserInsurerAccountRow } from './userInsurerAccountsApi'

function encodeToken(token: string) {
  return encodeURIComponent(token.trim())
}

function encodeUserId(userId: string) {
  return encodeURIComponent(userId.trim())
}

function usersPath(listToken: string) {
  return `/api/public/user-insurer-accounts/shared-list/${encodeToken(listToken)}/users`
}

function accountsPath(listToken: string, userId: string) {
  return `${usersPath(listToken)}/${encodeUserId(userId)}/accounts`
}

export async function fetchPublicSharedAccountUsers(listToken: string): Promise<SharedAccountUser[]> {
  const token = listToken.trim()
  if (!token) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  const rows = await apiRequest<SharedAccountUser[]>(usersPath(token))
  return Array.isArray(rows) ? rows : []
}

export async function fetchPublicSharedUserAccounts(
  listToken: string,
  userId: string,
): Promise<{ accounts: UserInsurerAccountRow[]; ownerDisplayName: string }> {
  const token = listToken.trim()
  const targetUserId = userId.trim()
  if (!token || !targetUserId) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  const { accounts, ownerDisplayName } = await apiRequest<{
    accounts: UserInsurerAccountRow[]
    ownerDisplayName: string
  }>(accountsPath(token, targetUserId))
  return { accounts, ownerDisplayName: ownerDisplayName ?? '' }
}

export async function createPublicSharedUserAccount(
  listToken: string,
  userId: string,
  payload: {
    category: UserInsurerAccountCategory
    companyName: string
    loginId?: string
    loginPassword?: string
    memo?: string
  },
): Promise<UserInsurerAccountRow> {
  const token = listToken.trim()
  const targetUserId = userId.trim()
  if (!token || !targetUserId) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>(
    accountsPath(token, targetUserId),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return account
}

export async function patchPublicSharedUserAccount(
  listToken: string,
  userId: string,
  id: string,
  payload: Partial<{ companyName: string; loginId: string; loginPassword: string; memo: string }>,
): Promise<UserInsurerAccountRow> {
  const token = listToken.trim()
  const targetUserId = userId.trim()
  if (!token || !targetUserId) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>(
    `${accountsPath(token, targetUserId)}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return account
}

export async function deletePublicSharedUserAccount(
  listToken: string,
  userId: string,
  id: string,
): Promise<void> {
  const token = listToken.trim()
  const targetUserId = userId.trim()
  if (!token || !targetUserId) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  await apiRequest<{ ok: boolean }>(`${accountsPath(token, targetUserId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
