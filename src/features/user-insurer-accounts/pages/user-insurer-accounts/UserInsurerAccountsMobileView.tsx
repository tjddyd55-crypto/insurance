import { AccountVaultManager } from '../../components/AccountVaultManager'
import { AccountVaultShareLinkActions } from '../../components/AccountVaultShareLinkActions'
import { AccountShareVisibilityToggle } from '../../components/AccountShareVisibilityToggle'
import type { UserInsurerAccountsPageViewProps } from '../UserInsurerAccountsPage'

export default function UserInsurerAccountsMobileView({
  adapter,
  shareLink,
  shareVisibility,
}: UserInsurerAccountsPageViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile user-insurer-accounts-page--personal page--with-back content-wrapper page-shell">
      <header className="user-insurer-accounts-page__header user-insurer-accounts-page__header--toolbar user-insurer-accounts-page__header--personal">
        <h1>계정관리</h1>
        <div className="user-insurer-accounts-page__header-toolbar">
          <AccountShareVisibilityToggle {...shareVisibility} />
          <AccountVaultShareLinkActions {...shareLink} />
        </div>
      </header>
      <AccountVaultManager mode="internal" layout="stacked" adapter={adapter} />
    </main>
  )
}
