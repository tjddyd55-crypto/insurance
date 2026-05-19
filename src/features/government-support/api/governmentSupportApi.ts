import { apiRequest } from '../../../lib/apiClient'

export type GovernmentAccessSummary = {
  userId: string
  isSuperAdmin: boolean
  isGovernmentIndustryAdmin: boolean
  isGovernmentTenantMember: boolean
  governmentIndustryAdminIndustryIds: string[]
  governmentAgencyAdminTenantIds: string[]
  governmentStaffTenantIds: string[]
}

function unwrapAccessPayload(raw: unknown): GovernmentAccessSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const nested = o.data
  const row =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : o
  const userId = typeof row.userId === 'string' ? row.userId : ''
  return {
    userId,
    isSuperAdmin: row.isSuperAdmin === true,
    isGovernmentIndustryAdmin: row.isGovernmentIndustryAdmin === true,
    isGovernmentTenantMember: row.isGovernmentTenantMember === true,
    governmentIndustryAdminIndustryIds: Array.isArray(row.governmentIndustryAdminIndustryIds)
      ? row.governmentIndustryAdminIndustryIds.map(String)
      : [],
    governmentAgencyAdminTenantIds: Array.isArray(row.governmentAgencyAdminTenantIds)
      ? row.governmentAgencyAdminTenantIds.map(String)
      : [],
    governmentStaffTenantIds: Array.isArray(row.governmentStaffTenantIds)
      ? row.governmentStaffTenantIds.map(String)
      : [],
  }
}

export async function fetchGovernmentAccessSummary(token: string): Promise<GovernmentAccessSummary> {
  const raw = await apiRequest<unknown>('/api/government-support/me/access', {
    method: 'GET',
    token,
  })
  const parsed = unwrapAccessPayload(raw)
  if (!parsed) {
    throw new Error('government-support 접근 정보를 불러오지 못했습니다.')
  }
  return parsed
}
