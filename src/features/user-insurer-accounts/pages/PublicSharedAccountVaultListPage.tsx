import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { publicSharedAccountVaultDetailPath } from '../api/sharedAccountListLinkApi'
import type { SharedAccountUser } from '../api/accountShareVisibilityApi'
import { usePublicSharedAccountVaultListState } from '../hooks/usePublicSharedAccountVaultListState'
import type { SharedAccountVaultListViewProps } from '../hooks/useSharedAccountVaultListState'
import PublicSharedAccountVaultListPCView from './public-shared-account-vault-list/PublicSharedAccountVaultListPCView'
import PublicSharedAccountVaultListMobileView from './public-shared-account-vault-list/PublicSharedAccountVaultListMobileView'

export default function PublicSharedAccountVaultListPage() {
  const { token: tokenParam } = useParams<{ token: string }>()
  const listToken = String(tokenParam ?? '').trim()
  const navigate = useNavigate()

  const openUser = useCallback(
    (user: SharedAccountUser) => {
      navigate(publicSharedAccountVaultDetailPath(listToken, user.userId), {
        state: { name: user.name },
      })
    },
    [listToken, navigate],
  )

  const viewProps = usePublicSharedAccountVaultListState(listToken, openUser)

  return (
    <ResponsiveLayout<SharedAccountVaultListViewProps>
      PC={PublicSharedAccountVaultListPCView}
      Mobile={PublicSharedAccountVaultListMobileView}
      viewProps={viewProps}
    />
  )
}
