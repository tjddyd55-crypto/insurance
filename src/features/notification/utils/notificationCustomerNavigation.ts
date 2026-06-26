import type { NavigateFunction } from 'react-router-dom'
import { openCustomerClaimWorkspace } from '../../customers/utils/customerClaimWorkspaceNavigation'
import { buildExternalCustomerNavigateTarget } from '../../customers/utils/customerRoutePaths'
import { parseSelectedCustomerId } from '../../customers/utils/customerWorkspaceNavigation'
import type { NotificationRow } from '../api/notificationApi'

export const NOTIFICATION_NAV_FROM = 'notification' as const

export type NotificationCustomerNavigationState = {
  from: typeof NOTIFICATION_NAV_FROM
  expandCustomerId: number
  customerName?: string
}

function resolveNotificationIsMobile(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches
}

export function parseNotificationExpandCustomerId(state: unknown): number | null {
  const entry = state as NotificationCustomerNavigationState | null
  if (entry?.from !== NOTIFICATION_NAV_FROM) {
    return null
  }
  return parseSelectedCustomerId(String(entry.expandCustomerId ?? ''))
}

export function openNotificationCustomerNavigate(params: {
  notification: NotificationRow
  navigate: NavigateFunction
  isMobile?: boolean
}): boolean {
  const customerId = params.notification.customerId
  if (customerId == null || customerId < 1) {
    return false
  }

  const isMobile = params.isMobile ?? resolveNotificationIsMobile()

  if (
    params.notification.type === 'claim_request_received' &&
    params.notification.claimRequestId != null
  ) {
    openCustomerClaimWorkspace({
      customerId,
      claimRequestId: params.notification.claimRequestId,
      customerName: params.notification.customerName ?? undefined,
      isMobile,
      navigate: params.navigate,
    })
    return true
  }

  const path = buildExternalCustomerNavigateTarget({
    customerId,
    isMobile,
  })
  const state: NotificationCustomerNavigationState = {
    from: NOTIFICATION_NAV_FROM,
    expandCustomerId: customerId,
    customerName: params.notification.customerName?.trim() || undefined,
  }
  params.navigate(path, { state })
  return true
}
