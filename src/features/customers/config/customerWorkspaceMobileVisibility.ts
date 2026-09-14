import type { CustomerWorkspaceActionsVariant } from '../components/CustomerWorkspaceActions'

/** Mobile Web / Native에서 고객 상세 action bar에 노출하지 않는 항목 (PC Web은 유지). */
export const CUSTOMER_WORKSPACE_ACTIONS_HIDDEN_ON_MOBILE = ['map', 'premiumPayments'] as const

export type CustomerWorkspaceActionVisibilityKey =
  (typeof CUSTOMER_WORKSPACE_ACTIONS_HIDDEN_ON_MOBILE)[number]

export function isCustomerWorkspaceActionVisible(
  variant: CustomerWorkspaceActionsVariant,
  action: CustomerWorkspaceActionVisibilityKey,
): boolean {
  if (variant === 'pc') {
    return true
  }
  return !CUSTOMER_WORKSPACE_ACTIONS_HIDDEN_ON_MOBILE.includes(action)
}
