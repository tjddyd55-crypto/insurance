import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { createStaffSharedAccountVaultAdapter, type AccountVaultAdapter } from '../api/accountVaultAdapter'
import { useSharedAccountVaultDetailState } from '../hooks/useSharedAccountVaultDetailState'
import SharedAccountVaultDetailPCView from './shared-account-vault-detail/SharedAccountVaultDetailPCView'
import SharedAccountVaultDetailMobileView from './shared-account-vault-detail/SharedAccountVaultDetailMobileView'

export type SharedAccountVaultDetailViewProps = {
  adapter: AccountVaultAdapter | null
  ownerName: string
  metaLoading: boolean
  accessError: string
}

export default function SharedAccountVaultDetailPage() {
  const { token } = useAuth()
  const authToken = token?.trim() ?? ''
  const { userId: userIdParam } = useParams<{ userId: string }>()
  const targetUserId = String(userIdParam ?? '').trim()
  const location = useLocation()
  const initialName = String((location.state as { name?: string } | null)?.name ?? '')

  const adapter = useMemo(
    () => createStaffSharedAccountVaultAdapter(authToken, targetUserId),
    [authToken, targetUserId],
  )
  const { ownerName, metaLoading, accessError } = useSharedAccountVaultDetailState(
    authToken,
    targetUserId,
    initialName,
  )

  return (
    <ResponsiveLayout<SharedAccountVaultDetailViewProps>
      PC={SharedAccountVaultDetailPCView}
      Mobile={SharedAccountVaultDetailMobileView}
      viewProps={{
        adapter: accessError ? null : adapter,
        ownerName,
        metaLoading,
        accessError,
      }}
    />
  )
}
