import type { AccountVaultAdapter } from '../api/accountVaultAdapter'
import { useAccountVaultState } from '../hooks/useAccountVaultState'
import { UserInsurerAccountsPanel } from './UserInsurerAccountsPanel'

type AccountVaultManagerProps = {
  mode: 'internal' | 'external'
  layout: 'dual-column' | 'stacked'
  adapter: AccountVaultAdapter | null
}

export function AccountVaultManager({ mode: _mode, layout, adapter }: AccountVaultManagerProps) {
  const state = useAccountVaultState(adapter)
  return <UserInsurerAccountsPanel {...state} layout={layout} />
}
