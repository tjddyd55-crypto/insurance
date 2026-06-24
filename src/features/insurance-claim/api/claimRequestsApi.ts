import { apiRequest } from '../../../lib/apiClient'

export type ClaimRequestDraft = {
  id: number
  customerId: number | null
  insuranceCompanyId: number
  insuranceCompanyName?: string | null
  status: string
  insuredSnapshot: Record<string, string>
  contractorSnapshot: Record<string, string> | null
  contractorSameAsInsured: boolean
  claimData: Record<string, string>
  paymentData: Record<string, string>
  signatureData: Record<string, unknown>
  sourceClaimRequestId: number | null
  createdAt?: string
  updatedAt?: string
}

export type ClaimCompany = { id: number; companyName: string; faxNumber: string }

export async function listClaimCompanies(token: string) {
  return apiRequest<{ companies: ClaimCompany[] }>('/api/insurance-claim/companies', { token })
}

export async function createClaimDraft(token: string, body: Omit<ClaimRequestDraft, 'id' | 'status' | 'sourceClaimRequestId'>) {
  return apiRequest<{ request: ClaimRequestDraft }>('/api/insurance-claim/requests', {
    method: 'POST', token, body: JSON.stringify(body),
  })
}

export async function getClaimRequest(token: string, id: number) {
  return apiRequest<{ request: ClaimRequestDraft }>(`/api/insurance-claim/requests/${id}`, { token })
}

export async function updateClaimDraft(token: string, id: number, body: Omit<ClaimRequestDraft, 'id' | 'status' | 'sourceClaimRequestId'>) {
  return apiRequest<{ request: ClaimRequestDraft }>(`/api/insurance-claim/requests/${id}`, {
    method: 'PATCH', token, body: JSON.stringify(body),
  })
}

export async function listClaimRequests(token: string) {
  return apiRequest<{ requests: ClaimRequestDraft[] }>('/api/insurance-claim/requests', { token })
}

export async function duplicateClaimRequest(token: string, id: number) {
  return apiRequest<{ request: ClaimRequestDraft }>(`/api/insurance-claim/requests/${id}/duplicate`, { method: 'POST', token })
}
