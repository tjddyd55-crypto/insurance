import { notificationBadgeLabel, notificationNavigateKind } from '@insurance-shared/userNotificationCatalog.js'
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
  | 'advisor_consultation_lead'

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
  return notificationBadgeLabel(type) || type || '알림'
}

export function buildNotificationNavigatePath(notification: NotificationRow): string | null {
  if (notificationNavigateKind(notification.type) === 'consultation_lead') {
    const leadId = String(notification.referenceId ?? '').trim()
    if (!leadId) return null
    return `/consultation-leads?lead=${encodeURIComponent(leadId)}`
  }
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

/** t321 Google 캘린더 자동 연동(알림 설정 안). 서버가 사용자별로 저장한다. */
export type GoogleAutoSyncKind = 'todo' | 'car_expiry' | 'insurance_age_date' | 'special_date'
export type GoogleAutoSyncState = {
  available: boolean
  connected: boolean
  calendarWritable: boolean
  accountEmail: string
  enabled: boolean
  kinds: Record<GoogleAutoSyncKind, boolean>
  lastSyncAt: string | null
  lastSyncError: string | null
  /** t327: 백그라운드 동기화 상태 */
  syncStatus?: 'idle' | 'syncing' | 'done' | 'error'
  windowDays: number
}

/** t327: 요청이 멈춰 보이지 않도록 제한 시간을 둔다. */
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await run(controller.signal)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('응답이 늦어 저장 여부를 확인하지 못했습니다. 잠시 후 다시 열어 확인해 주세요.', 0)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
export const GOOGLE_AUTOSYNC_TIMEOUT_MS = 20000

export async function fetchGoogleAutoSync(token: string): Promise<GoogleAutoSyncState> {
  const res = await withTimeout(GOOGLE_AUTOSYNC_TIMEOUT_MS, (signal) =>
    apiRequest<unknown>('/api/service-integrations/google/calendar-autosync', { token, signal }),
  )
  return asGoogleAutoSyncState(res)
}

/** apiRequest 는 { success, data } 를 data 로 풀어 줄 수 있으므로 두 모양을 모두 받는다. 모양이 틀리면 실패로 본다. */
function asGoogleAutoSyncState(raw: unknown): GoogleAutoSyncState {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const inner = obj && obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj
  if (!inner || typeof inner.enabled !== 'boolean' || !inner.kinds || typeof inner.kinds !== 'object') {
    throw new ApiError('Google 캘린더 자동 연동 상태를 확인하지 못했습니다.', 500)
  }
  return inner as unknown as GoogleAutoSyncState
}

export async function saveGoogleAutoSync(
  token: string,
  body: { enabled: boolean; kinds: Record<GoogleAutoSyncKind, boolean> },
): Promise<GoogleAutoSyncState> {
  const res = await withTimeout(GOOGLE_AUTOSYNC_TIMEOUT_MS, (signal) =>
    apiRequest<unknown>('/api/service-integrations/google/calendar-autosync', {
      method: 'PUT',
      token,
      body: JSON.stringify(body),
      signal,
    }),
  )
  const saved = asGoogleAutoSyncState(res)
  // 서버에 실제로 저장된 값이 요청과 다르면 성공으로 보지 않는다.
  if (saved.enabled !== body.enabled) {
    throw new ApiError('Google 캘린더 자동 연동 설정을 저장하지 못했습니다.', 500)
  }
  return saved
}
