/** government-support 업종 코드 (DB industries.code) */
export const GOVERNMENT_INDUSTRY_CODE = 'government'

/** user_memberships.role — government-support 전용 */
export const GOVERNMENT_MEMBERSHIP_ROLES = Object.freeze([
  'government_industry_admin',
  'government_agency_admin',
  'government_staff',
])

export const GOVERNMENT_MEMBERSHIP_ROLE_SET = new Set(GOVERNMENT_MEMBERSHIP_ROLES)
