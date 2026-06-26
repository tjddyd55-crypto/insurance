import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { UserInsurerAccountCategory } from '../config/userInsurerAccounts.config'

export type UserInsurerAccountRow = {
  id: string
  ownerUserId: string
  gaId: number | null
  category: UserInsurerAccountCategory | string
  companyName: string
  loginId: string
  loginPassword: string
  memo: string
  sortOrder: number
  isCustom: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export async function fetchUserInsurerAccounts(token: string): Promise<UserInsurerAccountRow[]> {
  if (!token.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const { accounts } = await apiRequest<{ accounts: UserInsurerAccountRow[] }>('/api/user-insurer-accounts', {
    token,
  })
  return accounts
}

export async function bootstrapUserInsurerAccountDefaults(token: string): Promise<UserInsurerAccountRow[]> {
  if (!token.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const { accounts } = await apiRequest<{ accounts: UserInsurerAccountRow[] }>(
    '/api/user-insurer-accounts/bootstrap-defaults',
    {
      method: 'POST',
      token,
      body: JSON.stringify({}),
    },
  )
  return accounts
}

export async function createUserInsurerAccount(
  token: string,
  payload: {
    category: UserInsurerAccountCategory
    companyName: string
    loginId?: string
    loginPassword?: string
    memo?: string
  },
): Promise<UserInsurerAccountRow> {
  if (!token.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>('/api/user-insurer-accounts', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
  return account
}

export async function patchUserInsurerAccount(
  token: string,
  id: string,
  payload: Partial<{
    companyName: string
    loginId: string
    loginPassword: string
    memo: string
  }>,
): Promise<UserInsurerAccountRow> {
  if (!token.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>(
    `/api/user-insurer-accounts/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    },
  )
  return account
}

export async function deleteUserInsurerAccount(token: string, id: string): Promise<void> {
  if (!token.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  await apiRequest<{ ok: boolean }>(`/api/user-insurer-accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  })
}
