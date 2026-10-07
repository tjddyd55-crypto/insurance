/** DB industries.code */
export const GOVERNMENT_INDUSTRY_CODE = 'government' as const

/** user_memberships.role (snake_case, server platformRbac 와 동일) */
export const GOVERNMENT_MEMBERSHIP_ROLES = [
  'government_industry_admin',
  'government_agency_admin',
  'government_staff',
] as const

export type GovernmentMembershipRole = (typeof GOVERNMENT_MEMBERSHIP_ROLES)[number]

export const GOVERNMENT_ROLE_LABELS: Record<GovernmentMembershipRole, string> = {
  government_industry_admin: '정부지원 업종 관리자',
  government_agency_admin: '정부지원 대행사 관리자',
  government_staff: '정부지원 대행사 직원',
}
