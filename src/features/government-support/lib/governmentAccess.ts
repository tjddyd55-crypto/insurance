import type { PlatformAccessSummary } from '../../platform/platformAdmin.types'
import { GOVERNMENT_INDUSTRY_CODE } from '../constants/governmentRoles'

export type GovernmentAccessState = 'loading' | 'denied' | 'industry_admin' | 'tenant_member' | 'super_admin'

/**
 * 플랫폼 access summary + JWT super_admin 로 government-support 진입 가능 여부 판별.
 * (government 전용 membership 필드는 서버 platformContext 확장 후 API에 추가될 수 있음 —
 *  1단계에서는 industryAdmin + tenant 스코프와 super_admin 으로 근사한다.)
 */
export function resolveGovernmentAccessState(
  summary: PlatformAccessSummary | null,
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
  if (summary.industryAdminIndustryIds.length > 0) {
    return 'industry_admin'
  }
  if (summary.tenantAdminTenantIds.length > 0 || summary.staffTenantIds.length > 0) {
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
