import { apiRequest } from '../../../lib/apiClient'

export type AdvisorConsultationLeadStatus = 'new' | 'checked' | 'completed'

export type AdvisorConsultationLead = {
  id: string
  advisorUserId: string
  visitorName: string
  phoneNormalized: string
  phoneDisplay: string
  message: string
  contactChannel: 'phone' | 'sms' | 'kakao' | string
  privacyConsent: boolean
  privacyConsentAt: string | null
  privacyPolicyVersion: string
  status: AdvisorConsultationLeadStatus
  checkedAt: string | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export async function fetchAdvisorConsultationLeads(token: string) {
  return apiRequest<{ items: AdvisorConsultationLead[]; newCount: number }>(
    '/api/me/advisor-consultation-leads',
    { token },
  )
}

export async function fetchAdvisorConsultationLead(token: string, id: string) {
  return apiRequest<{ item: AdvisorConsultationLead }>(
    `/api/me/advisor-consultation-leads/${encodeURIComponent(id)}`,
    { token },
  )
}

export async function patchAdvisorConsultationLead(
  token: string,
  id: string,
  body: { status: AdvisorConsultationLeadStatus },
) {
  return apiRequest<{ item: AdvisorConsultationLead }>(
    `/api/me/advisor-consultation-leads/${encodeURIComponent(id)}`,
    { method: 'PATCH', token, body: JSON.stringify(body) },
  )
}

export function consultationLeadStatusLabel(status: AdvisorConsultationLeadStatus): string {
  switch (status) {
    case 'new':
      return '신규'
    case 'checked':
      return '확인'
    case 'completed':
      return '완료'
    default:
      return status
  }
}

export function consultationChannelLabel(channel: string): string {
  switch (channel) {
    case 'phone':
      return '전화'
    case 'sms':
      return '문자'
    case 'kakao':
      return '카카오톡'
    default:
      return channel
  }
}
