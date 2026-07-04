import { AccountVaultManager } from '../../components/AccountVaultManager'
import { SHARED_USER_INSURER_ACCOUNT_CATEGORIES } from '../../config/userInsurerAccounts.config'
import type { ExternalAccountVaultViewProps } from '../ExternalAccountVaultPage'

export default function ExternalAccountVaultMobileView({
  adapter,
  title,
  metaLoading,
  metaError,
}: ExternalAccountVaultViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--mobile external-account-vault-page content-wrapper page-shell">
      <header className="user-insurer-accounts-page__header external-account-vault-page__header">
        <h1>{title}</h1>
      </header>
      {metaLoading ? <p className="user-insurer-accounts-page__muted">불러오는 중…</p> : null}
      {metaError ? (
        <p className="user-insurer-accounts-page__error" role="alert">
          {metaError}
        </p>
      ) : null}
      {!metaLoading && !metaError ? (
        <AccountVaultManager
          mode="external"
          layout="stacked"
          adapter={adapter}
          visibleCategories={SHARED_USER_INSURER_ACCOUNT_CATEGORIES}
        />
      ) : null}
    </main>
  )
}
