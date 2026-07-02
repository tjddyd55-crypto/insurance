import { apiRequest } from '../../../lib/apiClient'
import {
  normalizeTaCallSettings,
  normalizeTaCallWeekPayload,
  type TaCallSettings,
  type TaCallStatus,
  type TaCallWeekPayload,
} from '../types/taCall.types'

function requireToken(token: string): string {
  if (!token?.trim()) {
    throw new Error('로그인이 필요합니다.')
  }
  return token.trim()
}

export async function fetchTaCallSettings(token: string): Promise<TaCallSettings> {
  const raw = await apiRequest<TaCallSettings>('/api/ta/settings', { token: requireToken(token) })
  return normalizeTaCallSettings(raw)
}

export async function saveTaCallSettings(
  token: string,
  settings: TaCallSettings,
): Promise<TaCallSettings> {
  const raw = await apiRequest<TaCallSettings>('/api/ta/settings', {
    token: requireToken(token),
    method: 'PATCH',
    body: JSON.stringify({
      dailyTargetCount: settings.dailyTargetCount,
      targetGender: settings.targetGender,
      targetSangnyeongDays: settings.targetSangnyeongDays,
      targetInsuranceAgeMin: settings.targetInsuranceAgeMin,
      targetInsuranceAgeMax: settings.targetInsuranceAgeMax,
      excludeMinors: settings.excludeMinors,
    }),
  })
  return normalizeTaCallSettings(raw)
}

export async function fetchTaCallWeek(
  token: string,
  startDate?: string,
): Promise<TaCallWeekPayload> {
  const query = startDate ? `?startDate=${encodeURIComponent(startDate)}` : ''
  const raw = await apiRequest<TaCallWeekPayload>(`/api/ta/week${query}`, {
    token: requireToken(token),
  })
  return normalizeTaCallWeekPayload(raw)
}

export async function updateTaCallAssignmentStatus(
  token: string,
  assignmentId: string,
  status: TaCallStatus,
): Promise<void> {
  await apiRequest(`/api/ta/assignments/${encodeURIComponent(assignmentId)}/status`, {
    token: requireToken(token),
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
