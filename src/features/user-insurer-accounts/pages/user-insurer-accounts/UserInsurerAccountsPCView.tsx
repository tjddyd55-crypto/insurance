import { PersonalAccountVaultWorkspace } from './PersonalAccountVaultWorkspace'
import type { UserInsurerAccountsPageViewProps } from '../UserInsurerAccountsPage'

export default function UserInsurerAccountsPCView({
  adapter,
  shareLink,
  shareVisibility,
}: UserInsurerAccountsPageViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--pc user-insurer-accounts-page--personal page--with-back content-wrapper page-shell">
      <PersonalAccountVaultWorkspace
        layout="dual-column"
        adapter={adapter}
        shareLink={shareLink}
        shareVisibility={shareVisibility}
      />
    </main>
  )
}
