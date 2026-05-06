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
