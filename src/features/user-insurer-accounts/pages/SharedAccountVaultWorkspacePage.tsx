import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import type { SharedAccountUser } from '../api/accountShareVisibilityApi'
import { useSharedAccountListLinkState } from '../hooks/useSharedAccountListLinkState'
import { useSharedAccountVaultListState } from '../hooks/useSharedAccountVaultListState'
import SharedAccountVaultWorkspaceMobileView from './shared-account-vault-workspace/SharedAccountVaultWorkspaceMobileView'
import SharedAccountVaultWorkspacePCView from './shared-account-vault-workspace/SharedAccountVaultWorkspacePCView'
import type { SharedAccountVaultWorkspaceShellProps } from './shared-account-vault-workspace/SharedAccountVaultWorkspaceBody'

export function sharedAccountVaultDetailPath(userId: string): string {
  return `/insurance/account-credentials/shared/${encodeURIComponent(userId)}`
}

export function sharedAccountVaultListPath(): string {
  return '/insurance/account-credentials/shared'
}

export default function SharedAccountVaultWorkspacePage() {
  const { token } = useAuth()
  const authToken = token?.trim() ?? ''
  const { userId: userIdParam } = useParams<{ userId?: string }>()
  const selectedUserId = String(userIdParam ?? '').trim() || null
  const navigate = useNavigate()
  const location = useLocation()
  const detailInitialName = useMemo(
    () => String((location.state as { name?: string } | null)?.name ?? ''),
    [location.state],
  )

  const openUser = useCallback(
    (user: SharedAccountUser) => {
      navigate(sharedAccountVaultDetailPath(user.userId), {
        state: { name: user.name },
        replace: true,
      })
    },
    [navigate],
  )

  const listLink = useSharedAccountListLinkState(authToken)
  const listProps = useSharedAccountVaultListState(authToken, openUser, listLink)

  const viewProps: SharedAccountVaultWorkspaceShellProps = {
    ...listProps,
    selectedUserId,
    detailInitialName,
    workspaceMode: 'staff',
    authToken,
  }

  return (
    <ResponsiveLayout<SharedAccountVaultWorkspaceShellProps>
      PC={SharedAccountVaultWorkspacePCView}
      Mobile={SharedAccountVaultWorkspaceMobileView}
      viewProps={viewProps}
    />
  )
}
