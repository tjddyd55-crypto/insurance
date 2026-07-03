import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  useSharedAccountVaultListState,
  type SharedAccountVaultListViewProps,
} from '../hooks/useSharedAccountVaultListState'
import type { SharedAccountUser } from '../api/accountShareVisibilityApi'
import SharedAccountVaultListPCView from './shared-account-vault-list/SharedAccountVaultListPCView'
import SharedAccountVaultListMobileView from './shared-account-vault-list/SharedAccountVaultListMobileView'

export type { SharedAccountVaultListViewProps }

export function sharedAccountVaultDetailPath(userId: string): string {
  return `/insurance/account-credentials/shared/${encodeURIComponent(userId)}`
}

export default function SharedAccountVaultListPage() {
  const { token } = useAuth()
  const authToken = token?.trim() ?? ''
  const navigate = useNavigate()

  const openUser = useCallback(
    (user: SharedAccountUser) => {
      // 이름은 상세 배너 표기용으로만 넘긴다(없어도 상세가 서버에서 다시 조회함).
      navigate(sharedAccountVaultDetailPath(user.userId), { state: { name: user.name } })
    },
    [navigate],
  )

  const viewProps = useSharedAccountVaultListState(authToken, openUser)

  return (
    <ResponsiveLayout<SharedAccountVaultListViewProps>
      PC={SharedAccountVaultListPCView}
      Mobile={SharedAccountVaultListMobileView}
      viewProps={viewProps}
    />
  )
}
