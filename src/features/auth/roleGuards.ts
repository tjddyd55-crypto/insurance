import type { UserRole } from './authApi'

/** 원수사 연락처·회사 마스터 편집·조회에서 스태프로 취급하는 역할 */
export const INSURANCE_OPS_ROLES: UserRole[] = ['GA_ADMIN', 'GA_STAFF', 'SUPER_ADMIN']

export function isInsuranceOpsRole(role: string | undefined): role is UserRole {
  return role != null && (INSURANCE_OPS_ROLES as readonly string[]).includes(role)
}

/** 동의서 템플릿 등 StaffRoute 하위 */
export const STAFF_ROUTE_ROLES: UserRole[] = ['GA_ADMIN', 'GA_STAFF', 'SUPER_ADMIN']

export function canUseStaffRoutes(role: string | undefined): boolean {
  return role != null && (STAFF_ROUTE_ROLES as readonly string[]).includes(role)
}

/** 대시보드에서 원수사 안내 문구(일반 GA 소속 담당자) */
export function isGaTenantStaffRole(role: string | undefined): boolean {
  return role === 'GA_ADMIN' || role === 'GA_STAFF'
}
