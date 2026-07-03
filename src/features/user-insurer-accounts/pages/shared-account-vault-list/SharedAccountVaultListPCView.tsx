import { SharedAccountVaultListBody } from './SharedAccountVaultListBody'
import type { SharedAccountVaultListViewProps } from '../../hooks/useSharedAccountVaultListState'

export default function SharedAccountVaultListPCView(props: SharedAccountVaultListViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--pc shared-account-list shared-account-list--pc page--with-back content-wrapper page-shell">
      <SharedAccountVaultListBody {...props} />
    </main>
  )
}
