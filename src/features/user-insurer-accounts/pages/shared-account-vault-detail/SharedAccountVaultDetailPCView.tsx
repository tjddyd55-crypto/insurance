import { SharedAccountVaultDetailBody } from './SharedAccountVaultDetailBody'
import type { SharedAccountVaultDetailViewProps } from '../SharedAccountVaultDetailPage'

export default function SharedAccountVaultDetailPCView(props: SharedAccountVaultDetailViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--pc external-account-vault-page shared-account-detail shared-account-detail--pc content-wrapper page-shell">
      <SharedAccountVaultDetailBody {...props} layout="dual-column" />
    </main>
  )
}
