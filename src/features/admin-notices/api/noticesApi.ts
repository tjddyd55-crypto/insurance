import { apiRequest } from '../../../lib/apiClient'
import type { ActivePopupNotice } from '../types/adminNotice.types'

function isActivePopupNotice(value: unknown): value is ActivePopupNotice {
  return (
    value != null &&
    typeof value === 'object' &&
    'id' in value &&
    Number.isFinite(Number((value as ActivePopupNotice).id))
  )
}

export async function fetchActivePopupNotice(token: string): Promise<ActivePopupNotice | null> {
  const data = await apiRequest<ActivePopupNotice | null>('/api/notices/active-popup', { token })
  return isActivePopupNotice(data) ? data : null
}

export async function dismissPopupNotice(
  token: string,
  noticeId: number,
  options: { suppressToday?: boolean; forever?: boolean } = {},
): Promise<void> {
  await apiRequest(`/api/notices/${noticeId}/dismiss`, {
    token,
    method: 'POST',
    body: JSON.stringify({
      suppressToday: options.suppressToday === true,
      forever: options.forever === true,
    }),
  })
}
