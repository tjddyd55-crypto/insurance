import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { UserInsurerAccountCategory } from '../config/userInsurerAccounts.config'
import type { UserInsurerAccountRow } from './userInsurerAccountsApi'

function encodeToken(token: string) {
  return encodeURIComponent(token.trim())
}

export type ExternalAccountVaultMeta = {
  ok: boolean
  ownerDisplayName: string
}

export async function fetchExternalAccountVaultMeta(token: string): Promise<ExternalAccountVaultMeta> {
  const shareToken = token.trim()
  if (!shareToken) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  return apiRequest<ExternalAccountVaultMeta>(`/api/public/user-insurer-accounts/${encodeToken(shareToken)}`)
}

export async function fetchExternalAccountVaultAccounts(token: string): Promise<UserInsurerAccountRow[]> {
  const shareToken = token.trim()
  if (!shareToken) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  const { accounts } = await apiRequest<{ accounts: UserInsurerAccountRow[] }>(
    `/api/public/user-insurer-accounts/${encodeToken(shareToken)}/accounts`,
  )
  return accounts
}

export async function createExternalAccountVaultAccount(
  token: string,
  payload: {
    category: UserInsurerAccountCategory
    companyName: string
    loginId?: string
    loginPassword?: string
    memo?: string
  },
): Promise<UserInsurerAccountRow> {
  const shareToken = token.trim()
  if (!shareToken) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>(
    `/api/public/user-insurer-accounts/${encodeToken(shareToken)}/accounts`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return account
}

export async function patchExternalAccountVaultAccount(
  token: string,
  id: string,
  payload: Partial<{
    companyName: string
    loginId: string
    loginPassword: string
    memo: string
  }>,
): Promise<UserInsurerAccountRow> {
  const shareToken = token.trim()
  if (!shareToken) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  const { account } = await apiRequest<{ account: UserInsurerAccountRow }>(
    `/api/public/user-insurer-accounts/${encodeToken(shareToken)}/accounts/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return account
}

export async function deleteExternalAccountVaultAccount(token: string, id: string): Promise<void> {
  const shareToken = token.trim()
  if (!shareToken) {
    throw new ApiError('유효하지 않은 링크입니다.', 410)
  }
  await apiRequest<{ ok: boolean }>(
    `/api/public/user-insurer-accounts/${encodeToken(shareToken)}/accounts/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  )
}
