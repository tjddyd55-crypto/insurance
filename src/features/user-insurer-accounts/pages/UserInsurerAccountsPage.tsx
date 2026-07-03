import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useMemo } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { createInternalAccountVaultAdapter } from '../api/accountVaultAdapter'
import { useAccountVaultShareLinkState } from '../hooks/useAccountVaultShareLinkState'
import { useAccountShareVisibilityState } from '../hooks/useAccountShareVisibilityState'
import UserInsurerAccountsPCView from './user-insurer-accounts/UserInsurerAccountsPCView'
import UserInsurerAccountsMobileView from './user-insurer-accounts/UserInsurerAccountsMobileView'
import type { AccountVaultAdapter } from '../api/accountVaultAdapter'
import type { AccountVaultShareLinkViewProps } from '../hooks/useAccountVaultShareLinkState'
import type { AccountShareVisibilityViewProps } from '../hooks/useAccountShareVisibilityState'

export type UserInsurerAccountsPageViewProps = {
  adapter: AccountVaultAdapter | null
  shareLink: AccountVaultShareLinkViewProps
  shareVisibility: AccountShareVisibilityViewProps
}

export default function UserInsurerAccountsPage() {
  const { token } = useAuth()
  const authToken = token?.trim() ?? ''
  const adapter = useMemo(() => createInternalAccountVaultAdapter(authToken), [authToken])
  const shareLink = useAccountVaultShareLinkState(authToken)
  const shareVisibility = useAccountShareVisibilityState(authToken)

  return (
    <ResponsiveLayout<UserInsurerAccountsPageViewProps>
      PC={UserInsurerAccountsPCView}
      Mobile={UserInsurerAccountsMobileView}
      viewProps={{ adapter, shareLink, shareVisibility }}
    />
  )
}
