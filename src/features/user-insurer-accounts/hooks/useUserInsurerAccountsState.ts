import { useMemo } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { createInternalAccountVaultAdapter } from '../api/accountVaultAdapter'
import { useAccountVaultState, type AccountVaultViewProps } from './useAccountVaultState'

export type UserInsurerAccountsViewProps = AccountVaultViewProps

export function useUserInsurerAccountsState() {
  const { token } = useAuth()
  const authToken = token?.trim() ?? ''
  const adapter = useMemo(() => createInternalAccountVaultAdapter(authToken), [authToken])
  return useAccountVaultState(adapter)
}
