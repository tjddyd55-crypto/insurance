import { SharedAccountVaultDetailBody } from '../shared-account-vault-detail/SharedAccountVaultDetailBody'
import type { SharedAccountVaultDetailViewProps } from '../SharedAccountVaultDetailPage'

export default function PublicSharedAccountVaultDetailPCView(props: SharedAccountVaultDetailViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--pc external-account-vault-page content-wrapper page-shell">
      <SharedAccountVaultDetailBody {...props} layout="dual-column" />
    </main>
  )
}
