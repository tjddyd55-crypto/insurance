import { useMemo } from 'react'
import { createStaffSharedAccountVaultAdapter } from '../../api/accountVaultAdapter'
import { useSharedAccountVaultDetailState } from '../../hooks/useSharedAccountVaultDetailState'
import { SharedAccountVaultDetailBody } from '../shared-account-vault-detail/SharedAccountVaultDetailBody'

type SharedAccountVaultStaffDetailPanelProps = {
  authToken: string
  userId: string
  initialName: string
  layout: 'dual-column' | 'stacked'
}

export function SharedAccountVaultStaffDetailPanel({
  authToken,
  userId,
  initialName,
  layout,
}: SharedAccountVaultStaffDetailPanelProps) {
  const adapter = useMemo(
    () => createStaffSharedAccountVaultAdapter(authToken, userId),
    [authToken, userId],
  )
  const { ownerName, metaLoading, accessError } = useSharedAccountVaultDetailState(
    authToken,
    userId,
    initialName,
  )

  return (
    <SharedAccountVaultDetailBody
      adapter={accessError ? null : adapter}
      ownerName={ownerName}
      metaLoading={metaLoading}
      accessError={accessError}
      layout={layout}
      embedded
    />
  )
}
