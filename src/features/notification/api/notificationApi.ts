import { ApiError, apiRequest } from '../../../lib/apiClient'

export type NotificationRow = {
  id: string
  userId: string
  gaId: number
  teamId: string | null
  type: string
  referenceId: string | null
  message: string
  isRead: boolean
  isDismissed: boolean
  customerId: number | null
  customerName: string | null
  targetDate: string | null
  claimRequestId: number | null
  specialDateId?: number | null
  createdAt: string
}

export type WindowedAlertSetting = {
  enabled: boolean
  daysBefore: number
}

export type ToggleAlertSetting = {
  enabled: boolean
}

export type UserAlertSettings = {
  insuranceAge: WindowedAlertSetting
  carExpiry: WindowedAlertSetting
  specialDate: WindowedAlertSetting
  claimRequest: ToggleAlertSetting
}

/** 로그인 모달 억제 등 레거시 필드 */
export type LegacyNotificationSettings = {
  customerClaimMessage: boolean
  newCustomerRegistered: boolean
  insurerNewsUploaded: boolean
  carRenewalOneMonth: boolean
  insurerContactUpdated: boolean
  modalSuppressedUntil: string | null
}

export type NotificationListStatus = 'all' | 'unread' | 'read' | 'dismissed' | 'hidden'
export type NotificationListView = 'active' | 'confirmed'
export type NotificationListType =
  | 'all'
  | 'car_expiry'
  | 'insurance_age_date'
  | 'claim_request_received'
  | 'special_date'

export async function fetchNotifications(
  token: string,
  options: {
    limit?: number
    view?: NotificationListView
    status?: NotificationListStatus
    type?: NotificationListType
  } = {},
): Promise<{
  notifications: NotificationRow[]
  settings: UserAlertSettings
  legacySettings: LegacyNotificationSettings
}> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const lim = Math.min(100, Math.max(1, Math.floor(options.limit ?? 50)))
  const params = new URLSearchParams()
  params.set('limit', String(lim))
  if (options.view) {
    params.set('view', options.view)
  } else if (options.status) {
    params.set('status', options.status)
  }
  if (options.type) {
    params.set('type', options.type)
  }
  return apiRequest<{
    notifications: NotificationRow[]
    settings: UserAlertSettings
    legacySettings: LegacyNotificationSettings
  }>(`/api/notifications?${params.toString()}`, { token })
}

export async function fetchUnreadCount(token: string): Promise<{ count: number }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ count: number }>('/api/notifications/unread-count', { token })
}

export async function markNotificationRead(token: string, id: string): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const nid = String(id ?? '').trim()
  if (!nid) {
    throw new ApiError('알림을 찾을 수 없습니다.', 400)
  }
  return apiRequest<{ ok: boolean }>(`/api/notifications/${encodeURIComponent(nid)}/read`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({}),
  })
}

export async function dismissNotification(token: string, id: string): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const nid = String(id ?? '').trim()
  if (!nid) {
    throw new ApiError('알림을 찾을 수 없습니다.', 400)
  }
  return apiRequest<{ ok: boolean }>(`/api/notifications/${encodeURIComponent(nid)}/dismiss`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({}),
  })
}

export async function markAllNotificationsRead(token: string): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean }>('/api/notifications/read-all', {
    method: 'PATCH',
    token,
    body: JSON.stringify({}),
  })
}

export async function suppressNotificationModalToday(token: string): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean }>('/api/notifications/modal-suppress-today', {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  })
}

export async function fetchNotificationSettings(
  token: string,
): Promise<{ success: boolean; data: UserAlertSettings }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ success: boolean; data: UserAlertSettings }>('/api/notifications/settings', {
    token,
  })
}

export async function patchNotificationSettings(
  token: string,
  settings: Partial<UserAlertSettings>,
): Promise<{ success: boolean; data: UserAlertSettings }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ success: boolean; data: UserAlertSettings }>('/api/notifications/settings', {
    method: 'PATCH',
    token,
    body: JSON.stringify(settings),
  })
}

export function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'car_expiry':
      return '자동차 만기'
    case 'insurance_age_date':
      return '상령일'
    case 'claim_request_received':
      return '청구알림'
    case 'special_date':
      return '지정일'
    default:
      return type || '알림'
  }
}

export function buildNotificationNavigatePath(notification: NotificationRow): string | null {
  if (notification.customerId == null || notification.customerId < 1) {
    return null
  }
  if (notification.type === 'claim_request_received' && notification.claimRequestId != null) {
    const params = new URLSearchParams({
      customerId: String(notification.customerId),
      claimId: String(notification.claimRequestId),
    })
    return `/customers/${notification.customerId}/claim-requests?${params.toString()}`
  }
  return `/customers/${notification.customerId}/consultations`
}
