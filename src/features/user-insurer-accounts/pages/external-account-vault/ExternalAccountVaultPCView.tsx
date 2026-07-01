import { AccountVaultManager } from '../../components/AccountVaultManager'
import type { ExternalAccountVaultViewProps } from '../ExternalAccountVaultPage'

export default function ExternalAccountVaultPCView({
  adapter,
  title,
  metaLoading,
  metaError,
}: ExternalAccountVaultViewProps) {
  return (
    <main className="page user-insurer-accounts-page user-insurer-accounts-page--pc external-account-vault-page content-wrapper page-shell">
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
        <AccountVaultManager mode="external" layout="dual-column" adapter={adapter} />
      ) : null}
    </main>
  )
}
