import { clearSelectedCustomer } from '../storage/selectedCustomerStorage'
import { parseWorkspaceCustomerIdFromPath } from './customerWorkspaceNavigation'

export function buildCustomerWorkspaceAuthKey(
  userId: string | null | undefined,
  token: string | null | undefined,
): string | null {
  const id = String(userId ?? '').trim()
  const t = String(token ?? '').trim()
  if (!id || !t) {
    return null
  }
  return `${id}:${t.slice(0, 12)}`
}

export function shouldResetCustomerWorkspaceAuth(
  previousKey: string | null,
  nextKey: string | null,
): boolean {
  if (previousKey === null) {
    return false
  }
  return previousKey !== nextKey
}

export function clearCustomerWorkspaceClientState(): void {
  clearSelectedCustomer()
}

export function customerWorkspacePathHasCustomerSelection(pathname: string): boolean {
  return parseWorkspaceCustomerIdFromPath(pathname) != null
}
