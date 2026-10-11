import { apiRequest } from '../../../lib/apiClient'

export type SignupWelcomeSmsSetting = {
  ok: boolean
  message: string
  defaultMessage: string
  source: 'default' | 'custom'
  updatedAt: string | null
  updatedByUserId: string | null
}

export function fetchSignupWelcomeSmsSetting(token: string) {
  return apiRequest<SignupWelcomeSmsSetting>('/api/admin/settings/signup-welcome-sms', {
    method: 'GET',
    token,
  })
}

export function saveSignupWelcomeSmsSetting(token: string, message: string) {
  return apiRequest<SignupWelcomeSmsSetting>('/api/admin/settings/signup-welcome-sms', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ message }),
  })
}

export function resetSignupWelcomeSmsSetting(token: string) {
  return apiRequest<SignupWelcomeSmsSetting>('/api/admin/settings/signup-welcome-sms', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ resetToDefault: true }),
  })
}
