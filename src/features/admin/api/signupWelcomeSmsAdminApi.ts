import { apiRequest } from '../../../lib/apiClient'

export type SignupWelcomeSmsSettingsSource = 'default' | 'custom'

export type SignupWelcomeSmsSettings = {
  ok: boolean
  message: string
  defaultMessage: string
  source: SignupWelcomeSmsSettingsSource
  updatedAt: string | null
  updatedByUserId: string | null
}

export async function fetchSignupWelcomeSmsSettings(token: string): Promise<SignupWelcomeSmsSettings> {
  return apiRequest<SignupWelcomeSmsSettings>('/api/admin/settings/signup-welcome-sms', {
    method: 'GET',
    token,
  })
}

export async function saveSignupWelcomeSmsSettings(
  token: string,
  message: string,
): Promise<SignupWelcomeSmsSettings> {
  return apiRequest<SignupWelcomeSmsSettings>('/api/admin/settings/signup-welcome-sms', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ message }),
  })
}

export async function resetSignupWelcomeSmsSettings(token: string): Promise<SignupWelcomeSmsSettings> {
  return apiRequest<SignupWelcomeSmsSettings>('/api/admin/settings/signup-welcome-sms', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ resetToDefault: true }),
  })
}
