import {
  createUserInsurerAccount,
  deleteUserInsurerAccount,
  fetchUserInsurerAccounts,
  patchUserInsurerAccount,
  type UserInsurerAccountRow,
} from './userInsurerAccountsApi'
import {
  createExternalAccountVaultAccount,
  deleteExternalAccountVaultAccount,
  fetchExternalAccountVaultAccounts,
  patchExternalAccountVaultAccount,
} from './externalAccountVaultApi'
import type { UserInsurerAccountCategory } from '../config/userInsurerAccounts.config'

export type AccountVaultAdapter = {
  fetchAccounts: () => Promise<UserInsurerAccountRow[]>
  createAccount: (payload: {
    category: UserInsurerAccountCategory
    companyName: string
    loginId?: string
    loginPassword?: string
    memo?: string
  }) => Promise<UserInsurerAccountRow>
  patchAccount: (
    id: string,
    payload: Partial<{
      companyName: string
      loginId: string
      loginPassword: string
      memo: string
    }>,
  ) => Promise<UserInsurerAccountRow>
  deleteAccount: (id: string) => Promise<void>
}

export function createInternalAccountVaultAdapter(authToken: string): AccountVaultAdapter | null {
  const token = authToken.trim()
  if (!token) {
    return null
  }
  return {
    fetchAccounts: () => fetchUserInsurerAccounts(token),
    createAccount: (payload) => createUserInsurerAccount(token, payload),
    patchAccount: (id, payload) => patchUserInsurerAccount(token, id, payload),
    deleteAccount: (id) => deleteUserInsurerAccount(token, id),
  }
}

export function createExternalAccountVaultAdapter(shareToken: string): AccountVaultAdapter | null {
  const token = shareToken.trim()
  if (!token) {
    return null
  }
  return {
    fetchAccounts: () => fetchExternalAccountVaultAccounts(token),
    createAccount: (payload) => createExternalAccountVaultAccount(token, payload),
    patchAccount: (id, payload) => patchExternalAccountVaultAccount(token, id, payload),
    deleteAccount: (id) => deleteExternalAccountVaultAccount(token, id),
  }
}

export function formatExternalAccountVaultTitle(ownerDisplayName: string | null | undefined): string {
  const name = String(ownerDisplayName ?? '').trim()
  if (name) {
    return `${name}의 계정입니다`
  }
  return '사용자의 계정입니다'
}
