import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SharedAccountUser } from '../api/accountShareVisibilityApi'
import { publicSharedAccountVaultDetailPath } from '../api/sharedAccountListLinkApi'
import { usePublicSharedAccountVaultListState } from '../hooks/usePublicSharedAccountVaultListState'
import SharedAccountVaultWorkspaceMobileView from './shared-account-vault-workspace/SharedAccountVaultWorkspaceMobileView'
import SharedAccountVaultWorkspacePCView from './shared-account-vault-workspace/SharedAccountVaultWorkspacePCView'
import type { SharedAccountVaultWorkspaceShellProps } from './shared-account-vault-workspace/SharedAccountVaultWorkspaceBody'

export default function PublicSharedAccountVaultWorkspacePage() {
  const { token: tokenParam, userId: userIdParam } = useParams<{ token: string; userId?: string }>()
  const listToken = String(tokenParam ?? '').trim()
  const selectedUserId = String(userIdParam ?? '').trim() || null
  const navigate = useNavigate()
  const location = useLocation()
  const detailInitialName = useMemo(
    () => String((location.state as { name?: string } | null)?.name ?? ''),
    [location.state],
  )

  const openUser = useCallback(
    (user: SharedAccountUser) => {
      navigate(publicSharedAccountVaultDetailPath(listToken, user.userId), {
        state: { name: user.name },
        replace: true,
      })
    },
    [listToken, navigate],
  )

  const listProps = usePublicSharedAccountVaultListState(listToken, openUser)

  const viewProps: SharedAccountVaultWorkspaceShellProps = {
    ...listProps,
    selectedUserId,
    detailInitialName,
    workspaceMode: 'public',
    publicListToken: listToken,
  }

  return (
    <ResponsiveLayout<SharedAccountVaultWorkspaceShellProps>
      PC={SharedAccountVaultWorkspacePCView}
      Mobile={SharedAccountVaultWorkspaceMobileView}
      viewProps={viewProps}
    />
  )
}
