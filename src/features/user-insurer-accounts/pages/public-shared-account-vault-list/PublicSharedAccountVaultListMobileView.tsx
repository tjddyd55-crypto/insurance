import { SharedAccountVaultListBody } from '../shared-account-vault-list/SharedAccountVaultListBody'
import type { SharedAccountVaultListViewProps } from '../../hooks/useSharedAccountVaultListState'

export default function PublicSharedAccountVaultListMobileView(props: SharedAccountVaultListViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile shared-account-list shared-account-list--mobile external-account-vault-page content-wrapper page-shell">
      <SharedAccountVaultListBody {...props} />
    </main>
  )
}
