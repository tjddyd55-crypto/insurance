import { SharedAccountVaultDetailBody } from './SharedAccountVaultDetailBody'
import type { SharedAccountVaultDetailViewProps } from '../SharedAccountVaultDetailPage'

export default function SharedAccountVaultDetailMobileView(props: SharedAccountVaultDetailViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile external-account-vault-page shared-account-detail shared-account-detail--mobile content-wrapper page-shell">
      <SharedAccountVaultDetailBody {...props} layout="stacked" />
    </main>
  )
}
