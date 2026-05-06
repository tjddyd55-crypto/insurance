import { apiRequest } from '../../../lib/apiClient'
import type {
  AssignPlatformIndustryAdminResult,
  AssignPlatformTenantAdminResult,
  CreateIndustryInput,
  CreateIndustryResponse,
  CreatePlatformTenantInput,
  CreatePlatformTenantResponse,
  PlatformExternalAccountsSummaryResponse,
  PlatformIndustriesResponse,
  PlatformIndustryAdminsResponse,
  PlatformMembershipsResponse,
  PlatformTenantAdminsResponse,
  PlatformTenantsResponse,
  PlatformUserSearchResponse,
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

/** 업종별 스코프 — 응답 스키마는 전체 목록 GET 과 동일 */
export function fetchPlatformTenantsForIndustry(token: string, industryId: string) {
  const id = encodeURIComponent(industryId)
  return apiRequest<PlatformTenantsResponse>(`/api/admin/platform/industries/${id}/tenants`, {
    method: 'GET',
    token,
  })
}

export function fetchPlatformTenantAdmins(token: string, tenantId: string) {
  const id = encodeURIComponent(tenantId)
  return apiRequest<PlatformTenantAdminsResponse>(`/api/admin/platform/tenants/${id}/admins`, {
    method: 'GET',
    token,
  })
}

export function assignPlatformTenantAdmin(
  token: string,
  tenantId: string,
  body: { userId: string },
) {
  const id = encodeURIComponent(tenantId)
  return apiRequest<AssignPlatformTenantAdminResult>(`/api/admin/platform/tenants/${id}/admins`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  })
}

export function createPlatformTenant(token: string, industryId: string, input: CreatePlatformTenantInput) {
  const id = encodeURIComponent(industryId)
  const body: Record<string, unknown> = {
    code: input.code,
    name: input.name,
    status: input.status,
    config: {},
  }
  if (input.legacyGaId != null && Number.isInteger(input.legacyGaId) && input.legacyGaId > 0) {
    body.legacyGaId = input.legacyGaId
  }
  return apiRequest<CreatePlatformTenantResponse>(`/api/admin/platform/industries/${id}/tenants`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  })
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

/** 플랫폼 사용자 검색(Super Admin 전용 API) */
export function searchPlatformUsers(token: string, params: { q: string; limit?: number }) {
  const sp = new URLSearchParams()
  sp.set('q', params.q)
  if (params.limit != null) {
    sp.set('limit', String(params.limit))
  }
  return apiRequest<PlatformUserSearchResponse>(`/api/admin/platform/users/search?${sp.toString()}`, {
    method: 'GET',
    token,
  })
}
