import {
  SharedAccountVaultWorkspaceBody,
  type SharedAccountVaultWorkspaceShellProps,
} from './SharedAccountVaultWorkspaceBody'

export default function SharedAccountVaultWorkspacePCView(props: SharedAccountVaultWorkspaceShellProps) {
  const publicClass = props.publicMode ? ' external-account-vault-page' : ''
  return (
    <main
      className={`page user-insurer-accounts-page user-insurer-accounts-page--pc shared-account-list shared-account-list--pc shared-account-workspace-page shared-account-workspace-page--pc page--with-back content-wrapper page-shell${publicClass}`}
    >
      <SharedAccountVaultWorkspaceBody {...props} detailLayout="dual-column" />
    </main>
  )
}
