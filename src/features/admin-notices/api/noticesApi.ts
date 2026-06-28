import { apiRequest } from '../../../lib/apiClient'
import type { ActivePopupNotice } from '../types/adminNotice.types'

type ActivePopupResponse = {
  success: boolean
  data: ActivePopupNotice | null
}

export async function fetchActivePopupNotice(token: string): Promise<ActivePopupNotice | null> {
  const res = (await apiRequest('/api/notices/active-popup', { token })) as ActivePopupResponse
  return res.data ?? null
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
