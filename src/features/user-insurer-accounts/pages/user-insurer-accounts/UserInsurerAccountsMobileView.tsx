import { PersonalAccountVaultWorkspace } from './PersonalAccountVaultWorkspace'
import type { UserInsurerAccountsPageViewProps } from '../UserInsurerAccountsPage'

export default function UserInsurerAccountsMobileView({
  adapter,
  shareLink,
  shareVisibility,
  embedded = false,
}: UserInsurerAccountsPageViewProps) {
  const workspace = (
    <PersonalAccountVaultWorkspace
      layout="stacked"
      adapter={adapter}
      shareLink={shareLink}
      shareVisibility={shareVisibility}
    />
  )
  if (embedded) {
    return <div className="admin-data-card user-insurer-accounts-page--embedded">{workspace}</div>
  }
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile user-insurer-accounts-page--personal page--with-back content-wrapper page-shell">
      {workspace}
    </main>
  )
}
