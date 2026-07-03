import { SharedAccountVaultListBody } from './SharedAccountVaultListBody'
import type { SharedAccountVaultListViewProps } from '../../hooks/useSharedAccountVaultListState'

export default function SharedAccountVaultListMobileView(props: SharedAccountVaultListViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile shared-account-list shared-account-list--mobile page--with-back content-wrapper page-shell">
      <SharedAccountVaultListBody {...props} />
    </main>
  )
}
