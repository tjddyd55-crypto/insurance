import { FormButton } from '../../../../components/form'
import { AccountVaultShareLinkActions } from '../../components/AccountVaultShareLinkActions'
import { AccountShareVisibilityToggle } from '../../components/AccountShareVisibilityToggle'
import { UserInsurerAccountsPanel } from '../../components/UserInsurerAccountsPanel'
import type { AccountVaultAdapter } from '../../api/accountVaultAdapter'
import { useAccountVaultState } from '../../hooks/useAccountVaultState'
import { USER_INSURER_ACCOUNT_GENERAL_ADD_TOOLBAR_LABEL } from '../../config/userInsurerAccounts.config'
import type { AccountVaultShareLinkViewProps } from '../../hooks/useAccountVaultShareLinkState'
import type { AccountShareVisibilityViewProps } from '../../hooks/useAccountShareVisibilityState'

type PersonalAccountVaultWorkspaceProps = {
  layout: 'dual-column' | 'stacked'
  adapter: AccountVaultAdapter | null
  shareLink: AccountVaultShareLinkViewProps
  shareVisibility: AccountShareVisibilityViewProps
}

/**
 * 본인 계정관리 본문. vault 상태를 header toolbar와 panel이 공유해
 * 일반 계정 추가는 상단에서만 트리거한다.
 */
export function PersonalAccountVaultWorkspace({
  layout,
  adapter,
  shareLink,
  shareVisibility,
}: PersonalAccountVaultWorkspaceProps) {
  const vaultState = useAccountVaultState(adapter)
  const addDisabled = vaultState.loading || vaultState.pendingId === 'new'

  return (
    <>
      <header className="user-insurer-accounts-page__header user-insurer-accounts-page__header--toolbar user-insurer-accounts-page__header--personal">
        <h1>계정관리</h1>
        <div className="user-insurer-accounts-page__header-toolbar">
          <FormButton
            htmlType="button"
            variant="secondary"
            size="sm"
            className="user-insurer-accounts-page__general-add-button"
            disabled={addDisabled}
            onClick={() => vaultState.openAddModal('GENERAL')}
          >
            {USER_INSURER_ACCOUNT_GENERAL_ADD_TOOLBAR_LABEL}
          </FormButton>
          <AccountShareVisibilityToggle {...shareVisibility} />
          <AccountVaultShareLinkActions {...shareLink} />
        </div>
      </header>
      <UserInsurerAccountsPanel
        {...vaultState}
        layout={layout}
        showCategoryAddButtons={false}
      />
    </>
  )
}
