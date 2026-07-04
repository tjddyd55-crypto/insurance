import {
  SharedAccountVaultWorkspaceBody,
  type SharedAccountVaultWorkspaceShellProps,
} from './SharedAccountVaultWorkspaceBody'

export default function SharedAccountVaultWorkspaceMobileView(props: SharedAccountVaultWorkspaceShellProps) {
  const publicClass = props.publicMode ? ' external-account-vault-page' : ''
  const backClass = props.publicMode ? '' : ' page--with-back'
  return (
    <main
      className={`page user-insurer-accounts-page user-insurer-accounts-page--mobile shared-account-list shared-account-list--mobile shared-account-workspace-page shared-account-workspace-page--mobile${backClass} content-wrapper page-shell${publicClass}`}
    >
      <SharedAccountVaultWorkspaceBody {...props} detailLayout="stacked" />
    </main>
  )
}
