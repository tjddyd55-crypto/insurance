import { useAuth } from '../../../auth/AuthProvider'
import { GaStaffOpsNav } from '../../../auth/GaStaffOpsNav'
import '../../../auth/ga-staff-ops-shell.css'
import {
  SharedAccountVaultWorkspaceBody,
  type SharedAccountVaultWorkspaceShellProps,
} from './SharedAccountVaultWorkspaceBody'

export default function SharedAccountVaultWorkspacePCView(props: SharedAccountVaultWorkspaceShellProps) {
  const { user } = useAuth()
  const isGaStaff = user?.role === 'GA_STAFF'
  const publicClass = props.publicMode ? ' external-account-vault-page' : ''
  const staffShellClass = isGaStaff && !props.publicMode ? ' admin-page-shell ga-staff-ops-page' : ''
  return (
    <main
      className={`page user-insurer-accounts-page user-insurer-accounts-page--pc shared-account-list shared-account-list--pc shared-account-workspace-page shared-account-workspace-page--pc page--with-back content-wrapper page-shell${publicClass}${staffShellClass}`}
    >
      <div className={isGaStaff && !props.publicMode ? 'admin-page-shell__inner' : undefined}>
        {isGaStaff && !props.publicMode ? <GaStaffOpsNav /> : null}
        <SharedAccountVaultWorkspaceBody {...props} detailLayout="dual-column" />
      </div>
    </main>
  )
}
