import { apiRequest } from '../../lib/apiClient'

export type GaApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface PartnerGaOption {
  id: number
  name: string
}

export interface GaApprovalRequestRow {
  id: string
  status: GaApprovalStatus
  gaId: number
  gaName: string
  applicantUserId: string
  applicantUsername: string
  applicantName: string
  applicantPhone: string
  referrerName: string
  requestedAt: string | null
  processedAt: string | null
  processedByName: string
  rejectReason: string
}

export interface MyGaApprovalRequest {
  id: string
  status: GaApprovalStatus
  gaName: string
  requestedAt: string | null
  processedAt: string | null
  rejectReason: string
}

export async function searchPartnerGas(q: string): Promise<PartnerGaOption[]> {
  const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  const r = await apiRequest<{ items: PartnerGaOption[] }>(`/api/auth/partner-gas${qs}`, { method: 'GET' })
  return r.items ?? []
}

export async function fetchMyGaApproval(token: string): Promise<MyGaApprovalRequest | null> {
  const r = await apiRequest<{ request: MyGaApprovalRequest | null }>('/api/me/ga-approval', {
    method: 'GET',
    token,
  })
  return r.request ?? null
}

export async function listGaApprovals(
  token: string,
  status: GaApprovalStatus,
  gaId?: number | null,
): Promise<{ items: GaApprovalRequestRow[]; pendingCount: number }> {
  const p = new URLSearchParams({ status })
  if (gaId != null) p.set('ga_id', String(gaId))
  return apiRequest(`/api/ga-approvals?${p.toString()}`, { method: 'GET', token })
}

export async function approveGaApproval(token: string, id: string) {
  return apiRequest<{ id: string; status: GaApprovalStatus }>(`/api/ga-approvals/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  })
}

export async function rejectGaApproval(token: string, id: string, reason: string) {
  return apiRequest<{ id: string; status: GaApprovalStatus }>(`/api/ga-approvals/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    token,
    body: JSON.stringify({ reason }),
  })
}
