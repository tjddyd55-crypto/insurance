import { apiRequest } from '../../lib/apiClient'

export type ReferralRelationshipStatus = 'pending' | 'active' | 'inactive'

export interface ReferredUserSummary {
  name: string
  status: ReferralRelationshipStatus
  statusLabel: string
}

export interface ReferralSummaryResponse {
  referralCode: string
  referredUsers: ReferredUserSummary[]
}

export async function fetchReferralSummary(token: string): Promise<ReferralSummaryResponse> {
  return apiRequest<ReferralSummaryResponse>('/api/me/referral-summary', {
    method: 'GET',
    token,
  })
}

export async function validateReferralCodeForSignup(
  referralCode: string,
): Promise<{ valid: boolean; message?: string; benefitSummary?: string; source?: string }> {
  const code = referralCode.trim().toUpperCase().replace(/\s+/g, '')
  if (!code) {
    return { valid: true }
  }
  return apiRequest<{ valid: boolean; message?: string; benefitSummary?: string; source?: string }>(
    '/api/auth/validate-referral-code',
    {
      method: 'POST',
      body: JSON.stringify({ referral_code: code }),
    },
  )
}
