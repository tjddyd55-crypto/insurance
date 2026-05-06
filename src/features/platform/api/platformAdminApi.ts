import { apiRequest } from '../../../lib/apiClient'
import type {
  PlatformExternalAccountsSummaryResponse,
  PlatformIndustriesResponse,
  PlatformMembershipsResponse,
  PlatformTenantsResponse,
} from '../platformAdmin.types'

export function fetchPlatformIndustries(token: string) {
  return apiRequest<PlatformIndustriesResponse>('/api/admin/platform/industries', { method: 'GET', token })
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
