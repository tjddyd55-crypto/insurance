import { apiRequest } from '../../../lib/apiClient'
import type {
  AssignPlatformIndustryAdminResult,
  CreateIndustryInput,
  CreateIndustryResponse,
  PlatformExternalAccountsSummaryResponse,
  PlatformIndustriesResponse,
  PlatformIndustryAdminsResponse,
  PlatformMembershipsResponse,
  PlatformTenantsResponse,
} from '../platformAdmin.types'

export function fetchPlatformIndustries(token: string) {
  return apiRequest<PlatformIndustriesResponse>('/api/admin/platform/industries', { method: 'GET', token })
}

export function createIndustry(token: string, input: CreateIndustryInput) {
  const payload = {
    code: input.code,
    name: input.name,
    status: input.status,
    config: input.config ?? {},
  }
  return apiRequest<CreateIndustryResponse>('/api/admin/platform/industries', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  })
}

export function fetchPlatformIndustryAdmins(token: string, industryId: string) {
  const id = encodeURIComponent(industryId)
  return apiRequest<PlatformIndustryAdminsResponse>(
    `/api/admin/platform/industries/${id}/admins`,
    {
      method: 'GET',
      token,
    },
  )
}

export function assignPlatformIndustryAdmin(
  token: string,
  industryId: string,
  body: { userId: string },
) {
  const id = encodeURIComponent(industryId)
  return apiRequest<AssignPlatformIndustryAdminResult>(`/api/admin/platform/industries/${id}/admins`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  })
}

export function fetchPlatformTenants(token: string) {
  return apiRequest<PlatformTenantsResponse>('/api/admin/platform/tenants', { method: 'GET', token })
}

export function fetchPlatformMemberships(token: string) {
  return apiRequest<PlatformMembershipsResponse>('/api/admin/platform/memberships', { method: 'GET', token })
}

export function fetchPlatformExternalSummary(token: string) {
  return apiRequest<PlatformExternalAccountsSummaryResponse>('/api/admin/platform/external-accounts/summary', {
    method: 'GET',
    token,
  })
}
