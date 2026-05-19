import type { GovernmentAccessSummary } from '../api/governmentSupportApi'
import { GOVERNMENT_INDUSTRY_CODE } from '../constants/governmentRoles'

export type GovernmentAccessState = 'loading' | 'denied' | 'industry_admin' | 'tenant_member' | 'super_admin'

export function resolveGovernmentAccessState(
  summary: GovernmentAccessSummary | null,
  loading: boolean,
  hasToken: boolean,
): GovernmentAccessState {
  if (!hasToken) {
    return 'denied'
  }
  if (loading) {
    return 'loading'
  }
  if (!summary) {
    return 'denied'
  }
  if (summary.isSuperAdmin) {
    return 'super_admin'
  }
  if (summary.isGovernmentIndustryAdmin) {
    return 'industry_admin'
  }
  if (summary.isGovernmentTenantMember) {
    return 'tenant_member'
  }
  return 'denied'
}

export function canAccessGovernmentAdmin(state: GovernmentAccessState): boolean {
  return state === 'super_admin' || state === 'industry_admin'
}

export function canAccessGovernmentWorkspace(state: GovernmentAccessState): boolean {
  return state !== 'denied' && state !== 'loading'
}

export function governmentSignupIndustryCode(): typeof GOVERNMENT_INDUSTRY_CODE {
  return GOVERNMENT_INDUSTRY_CODE
}
