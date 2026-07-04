import { useMemo } from 'react'
import { createPublicSharedListAccountVaultAdapter } from '../../api/accountVaultAdapter'
import { usePublicSharedAccountVaultDetailState } from '../../hooks/usePublicSharedAccountVaultDetailState'
import { SharedAccountVaultDetailBody } from '../shared-account-vault-detail/SharedAccountVaultDetailBody'

type SharedAccountVaultPublicDetailPanelProps = {
  listToken: string
  userId: string
  initialName: string
  layout: 'dual-column' | 'stacked'
}

export function SharedAccountVaultPublicDetailPanel({
  listToken,
  userId,
  initialName,
  layout,
}: SharedAccountVaultPublicDetailPanelProps) {
  const adapter = useMemo(
    () => createPublicSharedListAccountVaultAdapter(listToken, userId),
    [listToken, userId],
  )
  const { ownerName, metaLoading, accessError } = usePublicSharedAccountVaultDetailState(
    listToken,
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
