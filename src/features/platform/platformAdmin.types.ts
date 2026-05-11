/** CRM 플랫폼 관리 API 타입 · 메타 테이블 */

export type PlatformIndustryRow = {
  id: string
  code: string
  name: string
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export type IndustryStatus = 'active' | 'inactive'

export type CreateIndustryInput = {
  code: string
  name: string
  status: IndustryStatus
  config?: Record<string, unknown>
}

export type CreateIndustryResponse = {
  id: string
  code: string
  name: string
  status: string
  config: Record<string, unknown>
  createdAt: string | null
  updatedAt: string | null
}

export type PlatformTenantsResponse = {
  items: PlatformTenantRow[]
}

export type PlatformTenantRow = {
  id: string
  industryId: string | null
  industryCode: string | null
  code: string
  name: string
  status: string
  legacyGaId: number | null
  /** 서버가 필드를 내려주지 않으면 미지정과 동일하게 취급 */
  crmCustomerTemplateId?: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type TenantStatus = 'active' | 'inactive'

export type CreatePlatformTenantInput = {
  code: string
  name: string
  status: TenantStatus
  /** 생략 시 서버에 전달하지 않음(null·미포함) */
  legacyGaId?: number | null
}

/** POST /admin/platform/industries/:id/tenants 201 — config·r2_key_prefix 없음 */
export type CreatePlatformTenantResponse = {
  id: string
  industryId: string
  industryCode: string
  code: string
  name: string
  status: string
  legacyGaId: number | null
  crmCustomerTemplateId: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type PlatformIndustriesResponse = {
  items: PlatformIndustryRow[]
}

/** GET /admin/platform/industries/:industryId/admins */
export type PlatformIndustryAdminMember = {
  membershipId: string
  userId: string
  username: string
  legacyRole: string
  membershipRole: string
  scopeType: string
  scopeId: string
  industryId: string
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export type PlatformIndustryAdminsResponse = {
  items: PlatformIndustryAdminMember[]
}

export type AssignIndustryAdminResultKind = 'created' | 'already_active' | 'reactivated'

export type AssignPlatformIndustryAdminResult = PlatformIndustryAdminMember & {
  result: AssignIndustryAdminResultKind
}

/** GET /admin/platform/tenants/:tenantId/admins */
export type PlatformTenantAdminMember = {
  membershipId: string
  userId: string
  username: string
  legacyRole: string
  membershipRole: string
  scopeType: string
  scopeId: string
  tenantId: string
  industryId: string
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export type PlatformTenantAdminsResponse = {
  items: PlatformTenantAdminMember[]
}

export type AssignTenantAdminResultKind = 'created' | 'already_active' | 'reactivated'

export type AssignPlatformTenantAdminResult = PlatformTenantAdminMember & {
  result: AssignTenantAdminResultKind
}

/** 테넌트 Staff/User 멤버십 (GET/POST `/admin/platform/tenants/:tenantId/members`) */
export type PlatformTenantMembershipRole = 'staff' | 'user'

export type PlatformTenantMember = {
  membershipId: string
  userId: string
  username: string
  displayName?: string
  legacyRole: string
  membershipRole: string
  scopeType: string
  scopeId: string
  tenantId: string
  industryId: string
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export type PlatformTenantMembersResponse = {
  items: PlatformTenantMember[]
}

export type AssignPlatformTenantMemberResultKind = 'created' | 'already_active' | 'reactivated'

export type AssignPlatformTenantMemberResult = PlatformTenantMember & {
  result: AssignPlatformTenantMemberResultKind
}

export type PlatformMembershipRow = {
  membershipId: string
  userId: string
  username: string
  legacyRole: string
  membershipRole: string
  scopeType: string
  scopeId: string | null
  tenantId: string | null
  tenantCode: string | null
  industryId: string | null
  industryCode: string | null
  status: string
  createdAt: string | null
  updatedAt: string | null
}

export type PlatformMembershipsResponse = {
  items: PlatformMembershipRow[]
}

/** GET /admin/platform/users/search — 플랫폼 슈퍼 전용 */
export type PlatformUserSearchItem = {
  id: string
  username: string
  displayName: string
  role: string
  status: string
  gaId: number | null
  gaCompanyName: string | null
}

export type PlatformUserSearchResponse = {
  items: PlatformUserSearchItem[]
}

export type PlatformExternalSummaryTenant = {
  tenantId: string
  tenantCode: string
  tenantName: string
  legacyGaId: number
  gaCode: string
  gaName: string
}

export type PlatformExternalSummaryCounts = {
  total: number
  active: number
}

export type PlatformExternalAccountsSummaryResponse = {
  tenant: PlatformExternalSummaryTenant
  insurerManagers: PlatformExternalSummaryCounts
  lossAdjusters: PlatformExternalSummaryCounts
}

/** GET /api/admin/platform/me/access — 모드 진입 가능 요약 */
export type PlatformAccessMode = 'platform' | 'industry' | 'tenant' | 'work'

export type PlatformAccessSummary = {
  userId: string
  legacyRole: string
  isSuperAdmin: boolean
  availableModes: PlatformAccessMode[]
  defaultMode: PlatformAccessMode | null
  industryAdminIndustryIds: string[]
  tenantAdminTenantIds: string[]
  staffTenantIds: string[]
  userTenantIds: string[]
  workTenantIds: string[]
}
