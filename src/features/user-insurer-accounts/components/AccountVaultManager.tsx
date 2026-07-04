import { useMemo } from 'react'
import type { AccountVaultAdapter } from '../api/accountVaultAdapter'
import { withVisibleAccountCategories } from '../api/accountVaultAdapter'
import {
  ALL_USER_INSURER_ACCOUNT_CATEGORIES,
  type UserInsurerAccountCategory,
} from '../config/userInsurerAccounts.config'
import { useAccountVaultState } from '../hooks/useAccountVaultState'
import { UserInsurerAccountsPanel } from './UserInsurerAccountsPanel'

type AccountVaultManagerProps = {
  mode: 'internal' | 'external'
  layout: 'dual-column' | 'stacked'
  adapter: AccountVaultAdapter | null
  visibleCategories?: UserInsurerAccountCategory[]
  showCategoryAddButtons?: boolean
}

export function AccountVaultManager({
  mode: _mode,
  layout,
  adapter,
  visibleCategories = ALL_USER_INSURER_ACCOUNT_CATEGORIES,
  showCategoryAddButtons = false,
}: AccountVaultManagerProps) {
  const effectiveAdapter = useMemo(
    () => (adapter ? withVisibleAccountCategories(adapter, visibleCategories) : null),
    [adapter, visibleCategories],
  )
  const state = useAccountVaultState(effectiveAdapter)
  return (
    <UserInsurerAccountsPanel
      {...state}
      layout={layout}
      visibleCategories={visibleCategories}
      showCategoryAddButtons={showCategoryAddButtons}
    />
  )
}
