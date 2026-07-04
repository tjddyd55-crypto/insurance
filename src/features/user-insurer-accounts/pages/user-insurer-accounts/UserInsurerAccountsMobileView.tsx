import { PersonalAccountVaultWorkspace } from './PersonalAccountVaultWorkspace'
import type { UserInsurerAccountsPageViewProps } from '../UserInsurerAccountsPage'

export default function UserInsurerAccountsMobileView({
  adapter,
  shareLink,
  shareVisibility,
}: UserInsurerAccountsPageViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile user-insurer-accounts-page--personal page--with-back content-wrapper page-shell">
      <PersonalAccountVaultWorkspace
        layout="stacked"
        adapter={adapter}
        shareLink={shareLink}
        shareVisibility={shareVisibility}
      />
    </main>
  )
}
