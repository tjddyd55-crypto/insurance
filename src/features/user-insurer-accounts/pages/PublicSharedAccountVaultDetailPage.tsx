import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { createPublicSharedListAccountVaultAdapter } from '../api/accountVaultAdapter'
import { usePublicSharedAccountVaultDetailState } from '../hooks/usePublicSharedAccountVaultDetailState'
import type { SharedAccountVaultDetailViewProps } from './SharedAccountVaultDetailPage'
import PublicSharedAccountVaultDetailPCView from './public-shared-account-vault-detail/PublicSharedAccountVaultDetailPCView'
import PublicSharedAccountVaultDetailMobileView from './public-shared-account-vault-detail/PublicSharedAccountVaultDetailMobileView'

export default function PublicSharedAccountVaultDetailPage() {
  const { token: tokenParam, userId: userIdParam } = useParams<{ token: string; userId: string }>()
  const listToken = String(tokenParam ?? '').trim()
  const targetUserId = String(userIdParam ?? '').trim()
  const location = useLocation()
  const initialName = String((location.state as { name?: string } | null)?.name ?? '')

  const adapter = useMemo(
    () => createPublicSharedListAccountVaultAdapter(listToken, targetUserId),
    [listToken, targetUserId],
  )
  const { ownerName, metaLoading, accessError } = usePublicSharedAccountVaultDetailState(
    listToken,
    targetUserId,
    initialName,
  )

  return (
    <ResponsiveLayout<SharedAccountVaultDetailViewProps>
      PC={PublicSharedAccountVaultDetailPCView}
      Mobile={PublicSharedAccountVaultDetailMobileView}
      viewProps={{
        adapter: accessError ? null : adapter,
        ownerName,
        metaLoading,
        accessError,
      }}
    />
  )
}
