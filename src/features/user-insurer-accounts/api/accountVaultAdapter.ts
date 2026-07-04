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
import {
  createSharedUserAccount,
  deleteSharedUserAccount,
  fetchSharedUserAccounts,
  patchSharedUserAccount,
} from './accountShareVisibilityApi'
import {
  createPublicSharedUserAccount,
  deletePublicSharedUserAccount,
  fetchPublicSharedUserAccounts,
  patchPublicSharedUserAccount,
} from './publicSharedAccountListVaultApi'
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

/**
 * 스태프가 같은 GA 의 공유 ON 사용자 계정관리를 다루는 adapter.
 * 기존 서비스 재사용을 위해 계정 서버 권한은 서버가 다시 검증한다(공유 ON + 같은 GA).
 */
export function createStaffSharedAccountVaultAdapter(
  authToken: string,
  targetUserId: string,
): AccountVaultAdapter | null {
  const token = authToken.trim()
  const userId = targetUserId.trim()
  if (!token || !userId) {
    return null
  }
  return {
    fetchAccounts: async () => (await fetchSharedUserAccounts(token, userId)).accounts,
    createAccount: (payload) => createSharedUserAccount(token, userId, payload),
    patchAccount: (id, payload) => patchSharedUserAccount(token, userId, id, payload),
    deleteAccount: (id) => deleteSharedUserAccount(token, userId, id),
  }
}

/**
 * 공개 "공유 계정관리 목록 URL" token 으로 대상 USER 계정관리를 다루는 adapter.
 */
export function createPublicSharedListAccountVaultAdapter(
  listToken: string,
  targetUserId: string,
): AccountVaultAdapter | null {
  const token = listToken.trim()
  const userId = targetUserId.trim()
  if (!token || !userId) {
    return null
  }
  return {
    fetchAccounts: async () => (await fetchPublicSharedUserAccounts(token, userId)).accounts,
    createAccount: (payload) => createPublicSharedUserAccount(token, userId, payload),
    patchAccount: (id, payload) => patchPublicSharedUserAccount(token, userId, id, payload),
    deleteAccount: (id) => deletePublicSharedUserAccount(token, userId, id),
  }
}

export function formatExternalAccountVaultTitle(ownerDisplayName: string | null | undefined): string {
  const name = String(ownerDisplayName ?? '').trim()
  if (name) {
    return `${name}의 계정입니다`
  }
  return '사용자의 계정입니다'
}

export const EXTERNAL_ACCOUNT_VAULT_LINK_DESCRIPTION = '보험사 계정관리 페이지입니다.'

export function formatExternalAccountVaultLinkTitle(ownerDisplayName: string | null | undefined): string {
  const name = String(ownerDisplayName ?? '').trim() || '사용자'
  return `${name} 계정관리`
}
