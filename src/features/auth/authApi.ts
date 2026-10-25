import { ApiError, apiRequest, resolveApiUrl } from '../../lib/apiClient'
import type { TenantCrmConfig } from '../customer-templates/customerTemplate.types'
import {
  normalizeSubscriptionFromApi,
  type SubscriptionSnapshot,
} from '../subscription/policy'

/**
 * 서버 /api/login, /api/me 응답에 포함되는 subscription 필드의 원시(raw) 모양.
 *
 * 서버가 snake_case 로 내려주는 그대로의 타입이며, 프론트 내부에서는
 * policy.ts 의 `normalizeSubscriptionFromApi` 로 SubscriptionSnapshot 으로 정규화해 사용한다.
 */
export interface SubscriptionResponsePayload {
  plan?: string | null
  effective_status?: string | null
  started_at?: string | null
  expires_at?: string | null
  remaining_days?: number | null
  reason?: string | null
  policy_active?: boolean | null
}

export type UserRole = 'SUPER_ADMIN' | 'GA_ADMIN' | 'GA_STAFF' | 'USER' | 'INSURER_MANAGER' | 'LOSS_ADJUSTER'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  gaId: number
  /** ga_companies.code (대문자). 구세션·JWT에는 없을 수 있음 → 빈 문자열 */
  gaCode: string
  /** ga_companies.name (표시용). 구세션에는 없을 수 있음 */
  gaName: string
  /** insurance_company_master.id — INSURER_MANAGER 에서만 필수 */
  companyId: number | null
  displayName: string
  /** users.team_id (팀 소속). 미소속이면 null */
  teamId: string | null
  /**
   * 서버가 내려준 구독 스냅샷(정규화 후).
   * 구세션/비대상 역할에서는 null 또는 undefined 로 남는다.
   */
  subscription?: SubscriptionSnapshot | null
  /** 서버가 내려준 동적 CRM 템플릿 JSON(로그인 브리지), useCustomerCrmIndustryContext 에서 parse */
  crmDynamicIndustryTemplate?: unknown

  /**
   * 로그인 시 테넌트·업종 브리지(`crm_industry_code`). 없거나 null 이면 보험 템플릿 폴백.
   */
  crmIndustryCode?: string | null
  /** tenants.config.crm 패치 */
  tenantCrm?: TenantCrmConfig | null
}

export interface LoginResponse {
  authKind?: 'STANDARD' | 'BOARD_WRITER'
  token: string
  redirectPath?: string
  writer?: {
    id: string
    loginId: string
    name: string
    isActive: boolean
  }
  user?: {
    id: string
    username: string
    role: UserRole
    ga_id: number | null
    ga_code?: string
    ga_name?: string
    company_id?: number | null
    display_name?: string | null
    team_id?: string | null
    subscription?: SubscriptionResponsePayload | null
    crm_industry_code?: string | null
    tenant_crm?: unknown
    crm_dynamic_industry_template?: unknown
  }
}

export type LoginSessionResult =
  | {
      authKind: 'STANDARD'
      token: string
      user: AuthUser
    }
  | {
      authKind: 'BOARD_WRITER'
      token: string
      redirectPath: string
    }

export type EntityStatus = 'active' | 'blocked' | 'inactive'

export interface GaCompanyRow {
  id: number
  name: string
  code: string
  status: EntityStatus
  /** t291b: 제휴 GA '가입 신청 허용' (기본 false) */
  accepts_partner_signup?: boolean
  created_at: string
  /** 슈퍼관리자 목록(페이지네이션) 조회 시만 채워짐 */
  groupId?: number | null
  groupName?: string | null
}

export interface GaCompanyAdminListResult {
  rows: GaCompanyRow[]
  total: number
  page: number
  pageSize: number
}

export type GaCompanyGroupFilter = 'all' | 'ungrouped' | number

export interface GaHistoryRow {
  id: number
  ga_id: number
  old_code: string
  new_code: string
  old_name: string
  new_name: string
  changed_by: string
  changed_at: string
}

export async function listGaCompanies(token: string): Promise<GaCompanyRow[]> {
  return apiRequest<GaCompanyRow[]>('/api/admin/ga', { method: 'GET', token })
}

export async function listGaCompaniesAdmin(
  token: string,
  params: {
    page: number
    pageSize: number
    q?: string
    groupFilter?: GaCompanyGroupFilter
  },
): Promise<GaCompanyAdminListResult> {
  const search = new URLSearchParams()
  search.set('page', String(params.page))
  search.set('pageSize', String(params.pageSize))
  const q = String(params.q ?? '').trim()
  if (q) {
    search.set('q', q)
  }
  const gf = params.groupFilter ?? 'all'
  if (gf === 'ungrouped') {
    search.set('groupFilter', 'ungrouped')
  } else if (typeof gf === 'number') {
    search.set('groupFilter', String(gf))
  } else {
    search.set('groupFilter', 'all')
  }
  return apiRequest<GaCompanyAdminListResult>(`/api/admin/ga?${search.toString()}`, {
    method: 'GET',
    token,
  })
}

/** 원수사 담당자 ↔ 보험사 마스터 정합성(감시용). SUPER_ADMIN 은 전체, 그 외는 소속 GA 만 */
export interface InsurerManagersHealth {
  total: number
  broken: number
  invalidCategory: number
  nullCompany: number
  fkBroken: number
  gaMismatch: number
}

export async function fetchInsurerManagersHealth(token: string): Promise<InsurerManagersHealth> {
  return apiRequest<InsurerManagersHealth>('/api/admin/health/insurer-managers', {
    method: 'GET',
    token,
  })
}

export interface SecurityAuditLogRow {
  id: string | number
  occurredAt?: string
  created_at: string
  action: string
  actionLabel?: string
  category?: string
  actorUserId?: string
  actor_user_id?: string
  actorUsername?: string | null
  actorDisplayName?: string
  role?: string
  actor_role?: string
  roleLabel?: string
  target?: string | null
  target_type?: string | null
  target_id?: string | null
  targetLabel?: string
  gaId?: number | null
  ga_id?: number | null
  company_id?: number | null
  summary?: string
  meta: unknown
  ipAddress?: string | null
  userAgent?: string | null
}

export async function fetchSecurityAuditLogs(
  token: string,
  params?: URLSearchParams | { limit?: number; action?: string; actor_user_id?: string; since?: string },
): Promise<SecurityAuditLogRow[]> {
  const q = params instanceof URLSearchParams ? params : new URLSearchParams()
  if (!(params instanceof URLSearchParams) && params) {
    if (params.limit != null) {
      q.set('limit', String(params.limit))
    }
    if (params.action?.trim()) {
      q.set('action', params.action.trim())
    }
    if (params.actor_user_id?.trim()) {
      q.set('actor_user_id', params.actor_user_id.trim())
    }
    if (params.since?.trim()) {
      q.set('since', params.since.trim())
    }
  }
  const qs = q.toString()
  const body = await apiRequest<{ logs?: SecurityAuditLogRow[] } | SecurityAuditLogRow[]>(
    `/api/admin/audit-logs${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    },
  )
  if (Array.isArray(body)) {
    return body
  }
  return Array.isArray(body.logs) ? body.logs : []
}

/** 서버와 동일 규칙(3~30자, 공백 불가) 충족 시 사용 가능 여부 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const u = username.trim()
  if (u.length < 3 || u.length > 30 || /\s/.test(u)) {
    return false
  }
  const r = await apiRequest<{ available: boolean }>(
    `/api/auth/username-availability?username=${encodeURIComponent(u)}`,
    { method: 'GET' },
  )
  return Boolean(r.available)
}

/** 회원가입 GA 코드 자동 조회 — GET /api/ga/validate */
export type ValidateGaSignupResponse = { success: boolean; gaName?: string; isGeneral?: boolean }

export type SignupPhonePolicyResponse = { devBypassEnabled?: boolean }

/** develop/test 가입 SMS·중복 완화 여부 — GET /api/auth/signup-phone-policy */
export async function fetchSignupPhonePolicy(): Promise<SignupPhonePolicyResponse> {
  const url = resolveApiUrl('/api/auth/signup-phone-policy')
  try {
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) {
      return { devBypassEnabled: false }
    }
    return (await res.json()) as SignupPhonePolicyResponse
  } catch {
    return { devBypassEnabled: false }
  }
}

export async function validateGaCodeForSignup(code: string): Promise<ValidateGaSignupResponse> {
  const c = code.trim()
  if (!c) {
    return { success: false }
  }
  const url = resolveApiUrl(`/api/ga/validate?code=${encodeURIComponent(c)}`)
  try {
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) {
      return { success: false }
    }
    const body = (await res.json()) as ValidateGaSignupResponse
    return body
  } catch {
    return { success: false }
  }
}

export async function fetchSignedInviteSignupUrl(token: string): Promise<{ path: string }> {
  return apiRequest<{ path: string }>('/api/auth/invite-signup-url', { method: 'GET', token })
}

export async function register(payload: {
  username: string
  password: string
  /** GA 코드(insurance 기본) */
  inviteCode?: string
  /** 테넌트 가입 코드 경로 */
  industryCode?: string
  registrationCode?: string
  /** 초대 담당자(users.id) — 있을 때만 서버에서 GA 일치 검증 */
  refUserId?: string
  /** 서버 HMAC — 초대 링크 경유 시에만 사용 */
  inviteSig?: string
  /** 링크 발행 시각(ms) — 초대 링크 경유 시에만 사용 */
  inviteTs?: string | number
  name: string
  /** 완화 모드에서는 생략 가능 */
  phoneNumber?: string
  signupPhoneProof?: string
  /** 선택 — 추천인 코드 */
  referralCode?: string
  /** GA 그룹 전용 가입 페이지 슬러그 */
  gaGroupSlug?: string
  /** t291: 'ga_partner' 이면 제휴 GA 승인 가입(공용으로 생성 + 승인 대기) */
  signupType?: 'public' | 'ga_partner'
  partnerGaId?: number
}) {
  try {
    const body: Record<string, string> = {
      username: payload.username.trim(),
      password: payload.password,
      name: payload.name.trim(),
    }
    const ind = payload.industryCode?.trim().toLowerCase()
    const reg = payload.registrationCode?.trim().toUpperCase().replace(/\s+/g, '')
    if (ind && reg) {
      body.industry_code = ind
      body.registration_code = reg
    } else {
      const invite = payload.inviteCode?.trim()
      if (invite) {
        body.invite_code = invite
      }
      /* GA 코드 없음 → 서버가 GENERAL(공용) 소속으로 처리 */
    }
    const refUserId = payload.refUserId?.trim()
    const inviteSig = payload.inviteSig?.trim()
    const inviteTs = payload.inviteTs != null ? String(payload.inviteTs).trim() : ''
    if (refUserId) {
      body.ref_user_id = refUserId
    }
    if (inviteSig) {
      body.invite_sig = inviteSig
    }
    if (inviteTs) {
      body.invite_ts = inviteTs
    }
    body.phone_number = String(payload.phoneNumber ?? '').trim()
    const proof = payload.signupPhoneProof?.trim()
    if (proof) {
      body.signup_phone_proof = proof
    }
    const referralCode = payload.referralCode?.trim().toUpperCase().replace(/\s+/g, '')
    if (referralCode) {
      body.referral_code = referralCode
    }
    const gaGroupSlug = payload.gaGroupSlug?.trim().toLowerCase()
    if (gaGroupSlug) {
      body.ga_group_slug = gaGroupSlug
    }
    if (payload.signupType === 'ga_partner' && payload.partnerGaId != null) {
      body.signup_type = 'ga_partner'
      body.partner_ga_id = String(payload.partnerGaId)
    }
    return await apiRequest<{
      id: string
      username: string
      ga_id: number
      createdAt: string
      ga_approval?: { status: string; ga_name: string }
    }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error(error.message || '이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

export async function sendSignupPhoneCode(
  payload:
    | { inviteCode?: string; phoneNumber: string }
    | { industryCode: string; registrationCode: string; phoneNumber: string },
) {
  const body: Record<string, string> = { phone_number: payload.phoneNumber }
  if ('inviteCode' in payload) {
    const invite = payload.inviteCode?.trim()
    if (invite) {
      body.invite_code = invite
    }
  } else {
    body.industry_code = payload.industryCode.trim().toLowerCase()
    body.registration_code = payload.registrationCode.trim().toUpperCase().replace(/\s+/g, '')
  }
  return apiRequest<{ ok?: boolean; message?: string; debugCode?: string }>(
    '/api/auth/send-signup-phone-code',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

export async function verifySignupPhoneCode(
  payload:
    | { inviteCode?: string; phoneNumber: string; code: string }
    | { industryCode: string; registrationCode: string; phoneNumber: string; code: string },
) {
  const body: Record<string, string> = {
    phone_number: payload.phoneNumber,
    code: payload.code.trim(),
  }
  if ('inviteCode' in payload) {
    const invite = payload.inviteCode?.trim()
    if (invite) {
      body.invite_code = invite
    }
  } else {
    body.industry_code = payload.industryCode.trim().toLowerCase()
    body.registration_code = payload.registrationCode.trim().toUpperCase().replace(/\s+/g, '')
  }
  return apiRequest<{
    ok?: boolean
    success?: boolean
    message?: string
    signup_phone_proof?: string
    data?: {
      ok?: boolean
      success?: boolean
      message?: string
      signup_phone_proof?: string
    }
  }>('/api/auth/verify-signup-phone-code', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function validateTenantRegistrationCodeForSignup(payload: {
  industryCode: string
  registrationCode: string
}): Promise<{ ok: boolean; message?: string; tenantName?: string }> {
  try {
    const res = await fetch(resolveApiUrl('/api/auth/validate-tenant-registration-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry_code: payload.industryCode.trim().toLowerCase(),
        registration_code: payload.registrationCode.trim().toUpperCase().replace(/\s+/g, ''),
      }),
    })
    const data = (await res.json()) as { ok?: boolean; message?: string; tenantName?: string }
    if (!res.ok) {
      return { ok: false, message: data.message ?? '가입 코드를 확인할 수 없습니다.' }
    }
    return { ok: Boolean(data.ok), tenantName: data.tenantName, message: data.message }
  } catch {
    return { ok: false, message: '네트워크 오류로 코드를 확인하지 못했습니다.' }
  }
}

export interface MeResponse {
  id: string
  username: string
  display_name: string
  phone_number: string
  role: string
  ga_id: number | null
  ga_code?: string
  ga_name?: string
  ga_group_name?: string | null
  status: string
  team_id: string | null
  subscription?: SubscriptionResponsePayload | null
}

export async function fetchMe(token: string): Promise<MeResponse> {
  return apiRequest<MeResponse>('/api/me', { method: 'GET', token })
}

export async function patchMe(
  token: string,
  body: {
    display_name?: string
    phone_number?: string
    phone_change_proof?: string
  },
): Promise<MeResponse> {
  return apiRequest<MeResponse>('/api/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function sendPhoneChangeCode(token: string, phoneNumber: string) {
  return apiRequest<{ ok?: boolean; message?: string; debugCode?: string }>(
    '/api/me/send-phone-change-code',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ phone_number: phoneNumber }),
    },
  )
}

export async function verifyPhoneChangeCode(token: string, phoneNumber: string, code: string) {
  return apiRequest<{ ok?: boolean; message?: string; phone_change_proof: string }>(
    '/api/me/verify-phone-change-code',
    {
      method: 'POST',
      token,
      body: JSON.stringify({ phone_number: phoneNumber, code: code.trim() }),
    },
  )
}

function parseLoginTenantCrm(raw: unknown): TenantCrmConfig | null {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as TenantCrmConfig
}

export async function login(username: string, password: string): Promise<LoginSessionResult> {
  const raw = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), password }),
  })
  if (raw.authKind === 'BOARD_WRITER') {
    return {
      authKind: 'BOARD_WRITER',
      token: raw.token,
      redirectPath: String(raw.redirectPath ?? '/board-writer/workspace'),
    }
  }
  if (!raw.user) {
    throw new Error('로그인 응답이 올바르지 않습니다.')
  }
  return mapStandardLoginResponse(raw)
}

/**
 * t291: DB 기준 JWT·user 재발급(GA 가입 승인 반영 — 재로그인 불필요).
 * 일반 users 계정 전용. 로그인 이력은 남기지 않는다.
 */
export async function refreshUserSession(token: string): Promise<LoginSessionResult> {
  const raw = await apiRequest<LoginResponse>('/api/auth/session/refresh', { method: 'POST', token })
  if (!raw.user) {
    throw new Error('세션 갱신 응답이 올바르지 않습니다.')
  }
  return mapStandardLoginResponse(raw)
}

function mapStandardLoginResponse(raw: LoginResponse): LoginSessionResult {
  if (!raw.user) {
    throw new Error('로그인 응답이 올바르지 않습니다.')
  }
  const gaCode =
    typeof raw.user.ga_code === 'string' ? raw.user.ga_code.trim().toUpperCase() : ''
  const gaName = typeof raw.user.ga_name === 'string' ? raw.user.ga_name.trim() : ''
  const gaId =
    typeof raw.user.ga_id === 'number' && Number.isInteger(raw.user.ga_id) && raw.user.ga_id > 0
      ? raw.user.ga_id
      : 0
  const rawCid = raw.user.company_id
  const companyId =
    typeof rawCid === 'number' && Number.isInteger(rawCid) && rawCid > 0 ? rawCid : null
  const displayName =
    typeof raw.user.display_name === 'string'
      ? raw.user.display_name.trim()
      : String(raw.user.username ?? '').trim()
  const rawTeam = raw.user.team_id
  const teamId =
    typeof rawTeam === 'string' && rawTeam.trim() ? rawTeam.trim() : null
  const subscription = normalizeSubscriptionFromApi(raw.user.subscription)

  const crmIc = raw.user.crm_industry_code
  const crmIndustryCode =
    crmIc == null ? null : typeof crmIc === 'string' && crmIc.trim() ? crmIc.trim() : String(crmIc).trim()
  const tenantCrm = parseLoginTenantCrm(raw.user.tenant_crm)

  return {
    authKind: 'STANDARD',
    token: raw.token,
    user: {
      id: raw.user.id,
      username: raw.user.username,
      role: raw.user.role,
      gaId,
      gaCode,
      gaName,
      companyId: raw.user.role === 'INSURER_MANAGER' ? companyId : null,
      displayName,
      teamId,
      subscription,
      crmIndustryCode: crmIndustryCode || null,
      tenantCrm,
      ...(raw.user.crm_dynamic_industry_template != null
        ? { crmDynamicIndustryTemplate: raw.user.crm_dynamic_industry_template }
        : {}),
    },
  }
}

export type GaDelegateRole = 'GA_ADMIN' | 'GA_STAFF'

export interface CreateDelegateUserResponse {
  success: boolean
  data: {
    id: string
    username: string
    role: GaDelegateRole
    ga_id: number
    displayName: string
  }
}

export async function createDelegateUser(
  token: string,
  payload: { username: string; password: string; name?: string; gaId: number; role: GaDelegateRole },
) {
  try {
    return await apiRequest<CreateDelegateUserResponse>('/api/admin/user', {
      method: 'POST',
      token,
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        name: payload.name ?? '',
        ga_id: payload.gaId,
        role: payload.role,
      }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

/** @deprecated 하위 호환 — createDelegateUser({ role: 'GA_ADMIN' }) 사용 권장 */
export async function createStaffAccount(
  token: string,
  payload: { username: string; password: string; name?: string; gaId: number },
) {
  return createDelegateUser(token, { ...payload, role: 'GA_ADMIN' })
}

export interface AdminUserRow {
  id: string
  ga_id: number
  /** 표시 이름 (없으면 빈 문자열) */
  display_name: string
  ga_company_name: string
  username: string
  /** CRM 사용자 프로필 연락처 SSOT (`users.phone_number`). 없으면 null */
  phone_number: string | null
  role: UserRole
  status: EntityStatus
  created_at: string
  referrer_user_id: string | null
  referrer_username: string | null
  referrer_display_name: string | null
  referrer_ga_company_name: string | null
  last_login_at: string | null
  /** 실제 사용 접속 시각(15분 단위 갱신). 기록 시작 전 사용자는 null */
  last_seen_at?: string | null
  /** 기록 시작 이후 최초 접속 채널 (ClientType) */
  first_client_type?: string | null
  last_client_type?: string | null
  last_device_model?: string | null
  last_app_version?: string | null
  subscription_status: string | null
  /** 서버 계산: free | paid | ended */
  subscription_effective_category?: 'free' | 'paid' | 'ended'
  subscription_entitled?: boolean
  subscription_status_label: string
  subscription_until: string | null
  subscription_list_label: string
}

export type AdminUserAccessSession = {
  createdAt: string
  clientType: string | null
  platform: string | null
  deviceModel: string | null
  appVersion: string | null
}

/** GET /api/admin/users/:id/access-context — IP 미포함 */
export type AdminUserAccessContext = {
  userId: string
  createdAt: string | null
  lastLoginAt: string | null
  lastSeenAt: string | null
  firstClientType: string | null
  lastClientType: string | null
  lastDeviceModel: string | null
  lastAppVersion: string | null
  usedClientTypes: string[]
  recentSessions: AdminUserAccessSession[]
}

export async function fetchAdminUserAccessContext(token: string, userId: string) {
  return apiRequest<AdminUserAccessContext>(
    `/api/admin/users/${encodeURIComponent(userId)}/access-context`,
    { method: 'GET', token },
  )
}

export type AdminUserListFilters = {
  gaId?: number
  subscriptionStatus?: string
  q?: string
  role?: string
  status?: EntityStatus | ''
  hasPhone?: 'yes' | 'no' | ''
  newMember?: 'monthly_new' | ''
  activity?: string
  sort?: string
}

export type AdminUsersOverviewSummary = {
  totalUsers: number
  monthlyNewUsers: number
  todayActiveUsers: number
  recent7DaysActiveUsers: number
}

/** 슈퍼 관리자 — GA 담당자(GA_ADMIN/GA_STAFF) 전용. 비밀번호는 관리 목적 평문(일반 유저와 무관). */
export interface GaDelegateRow {
  id: string
  ga_id: number
  gaCode: string
  gaName: string
  username: string
  password: string
  role: GaDelegateRole
  status: EntityStatus
  /** ACTIVE | BLOCKED | INACTIVE 표기 */
  statusLabel: string
  created_at: string
}

export async function listGaDelegates(token: string): Promise<GaDelegateRow[]> {
  return apiRequest<GaDelegateRow[]>('/api/admin/delegates', { method: 'GET', token })
}

export async function createGaDelegate(
  token: string,
  payload: { gaId: number; username: string; password: string; name?: string; role: GaDelegateRole },
) {
  try {
    return await apiRequest<GaDelegateRow>('/api/admin/delegates', {
      method: 'POST',
      token,
      body: JSON.stringify({
        ga_id: payload.gaId,
        username: payload.username,
        password: payload.password,
        name: payload.name ?? '',
        role: payload.role,
      }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

/** GA_ADMIN — 자기 GA STEP·관리자 목록(비밀번호 미포함) */
export interface GaAdminDelegateRow {
  id: string
  ga_id: number
  gaCode: string
  gaName: string
  username: string
  role: GaDelegateRole
  status: EntityStatus
  statusLabel: string
  created_at: string
  updated_at?: string
  displayName?: string
  last_login_at?: string | null
}

export async function listGaAdminDelegates(token: string): Promise<GaAdminDelegateRow[]> {
  return apiRequest<GaAdminDelegateRow[]>('/api/ga-admin/delegates', { method: 'GET', token })
}

export async function createGaAdminDelegate(
  token: string,
  payload: { username: string; password: string; name?: string },
) {
  try {
    return await apiRequest<GaAdminDelegateRow>('/api/ga-admin/delegates', {
      method: 'POST',
      token,
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        name: payload.name ?? '',
      }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

export async function patchGaAdminDelegate(
  token: string,
  id: string,
  body: { username?: string; password?: string; status?: EntityStatus; displayName?: string; name?: string },
) {
  try {
    const payload: Record<string, unknown> = {}
    if (body.username != null) {
      payload.username = body.username
    }
    if (body.password != null && body.password.trim() !== '') {
      payload.password = body.password
    }
    if (body.status != null) {
      payload.status = body.status
    }
    const displayName = body.displayName ?? body.name
    if (displayName != null) {
      payload.displayName = displayName
    }
    return await apiRequest<GaAdminDelegateRow>(`/api/ga-admin/delegates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

/** SUPER_ADMIN — GA 상세의 GA_ADMIN 계정 (비밀번호 미노출) */
export interface SuperAdminGaAdminAccountRow {
  id: string
  ga_id: number
  username: string
  displayName: string
  phone_number: string | null
  role: 'GA_ADMIN'
  status: EntityStatus
  statusLabel: string
  created_at: string
  last_login_at: string | null
}

export async function listSuperAdminGaAdminAccounts(
  token: string,
  gaId: number,
): Promise<SuperAdminGaAdminAccountRow[]> {
  return apiRequest<SuperAdminGaAdminAccountRow[]>(`/api/admin/ga/${gaId}/ga-admins`, { method: 'GET', token })
}

export async function createSuperAdminGaAdminAccount(
  token: string,
  gaId: number,
  payload: { username: string; password: string; name?: string; phoneNumber?: string },
) {
  try {
    return await apiRequest<SuperAdminGaAdminAccountRow>(`/api/admin/ga/${gaId}/ga-admins`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        name: payload.name ?? '',
        phone_number: payload.phoneNumber ?? '',
      }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

export async function patchSuperAdminGaAdminAccount(
  token: string,
  gaId: number,
  userId: string,
  body: {
    username?: string
    password?: string
    status?: EntityStatus
    displayName?: string
    name?: string
    phoneNumber?: string
  },
) {
  try {
    const payload: Record<string, unknown> = {}
    if (body.username != null) {
      payload.username = body.username
    }
    if (body.password != null && body.password.trim() !== '') {
      payload.password = body.password
    }
    if (body.status != null) {
      payload.status = body.status
    }
    const displayName = body.displayName ?? body.name
    if (displayName != null) {
      payload.displayName = displayName
    }
    if (body.phoneNumber != null) {
      payload.phone_number = body.phoneNumber
    }
    return await apiRequest<SuperAdminGaAdminAccountRow>(
      `/api/admin/ga/${gaId}/ga-admins/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      },
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

export async function patchGaDelegate(
  token: string,
  id: string,
  body: { username?: string; password?: string; status?: EntityStatus },
) {
  try {
    const payload: Record<string, unknown> = {}
    if (body.username != null) {
      payload.username = body.username
    }
    if (body.password != null && body.password.trim() !== '') {
      payload.password = body.password
    }
    if (body.status != null) {
      payload.status = body.status
    }
    return await apiRequest<GaDelegateRow>(`/api/admin/delegates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

export async function listAdminUsers(
  token: string,
  filters: AdminUserListFilters = {},
): Promise<AdminUserRow[]> {
  const params = new URLSearchParams()
  if (filters.gaId != null && Number.isInteger(filters.gaId)) {
    params.set('ga_id', String(filters.gaId))
  }
  if (filters.subscriptionStatus?.trim()) {
    params.set('subscription_status', filters.subscriptionStatus.trim())
  }
  if (filters.q?.trim()) {
    params.set('q', filters.q.trim())
  }
  if (filters.role?.trim()) {
    params.set('role', filters.role.trim())
  }
  if (filters.status?.trim()) {
    params.set('status', filters.status.trim())
  }
  if (filters.hasPhone === 'yes' || filters.hasPhone === 'no') {
    params.set('has_phone', filters.hasPhone)
  }
  if (filters.newMember === 'monthly_new') {
    params.set('new_member', 'monthly')
  }
  if (filters.activity?.trim()) {
    params.set('activity', filters.activity.trim())
  }
  if (filters.sort?.trim()) {
    params.set('sort', filters.sort.trim())
  }
  const qs = params.toString()
  return apiRequest<AdminUserRow[]>(`/api/admin/users${qs ? `?${qs}` : ''}`, { method: 'GET', token })
}

export async function fetchAdminUsersOverviewSummary(
  token: string,
): Promise<AdminUsersOverviewSummary> {
  return apiRequest<AdminUsersOverviewSummary>('/api/admin/users/summary', { method: 'GET', token })
}

export async function patchAdminUser(
  token: string,
  userId: string,
  body: { ga_id?: number; role?: string; status?: EntityStatus },
) {
  const payload: Record<string, unknown> = {}
  if (body.ga_id != null) {
    payload.ga_id = body.ga_id
  }
  if (body.role != null) {
    payload.role = body.role
  }
  if (body.status != null) {
    payload.status = body.status
  }
  return apiRequest<AdminUserRow>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminUser(token: string, userId: string): Promise<void> {
  await apiRequest<unknown>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    token,
  })
}

export async function createGaCompany(token: string, payload: { name: string; code: string }) {
  try {
    return await apiRequest<GaCompanyRow>('/api/admin/ga', {
      method: 'POST',
      token,
      body: JSON.stringify({ name: payload.name.trim(), code: payload.code.trim().toUpperCase() }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 존재하는 코드입니다')
    }
    throw error
  }
}

export async function patchGaCompany(
  token: string,
  id: number,
  body: { name?: string; code?: string; status?: EntityStatus; accepts_partner_signup?: boolean },
) {
  try {
    return await apiRequest<GaCompanyRow>(`/api/admin/ga/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 존재하는 코드입니다')
    }
    throw error
  }
}

export async function listGaCompanyHistory(token: string, id: number): Promise<GaHistoryRow[]> {
  return apiRequest<GaHistoryRow[]>(`/api/admin/ga/${id}/history`, {
    method: 'GET',
    token,
  })
}

export async function deleteGaCompany(token: string, id: number): Promise<void> {
  await apiRequest<unknown>(`/api/admin/ga/${id}`, {
    method: 'DELETE',
    token,
  })
}

export type FeatureRequestStatus = 'pending' | 'reviewed' | 'done'

export type FeatureRequestType = 'error' | 'inquiry' | 'feature' | 'other'

export interface FeatureRequestAdminRow {
  id: number
  ga_id: number
  ga_name: string
  username: string
  /** display_name / name — 없으면 빈 문자열 */
  user_name?: string
  title: string
  content: string
  status: FeatureRequestStatus
  request_type: FeatureRequestType
  created_at: string
  comment_count: number
}

// 문의/요청 댓글.
// - authorRole 은 서버가 넣어주는 값("admin" 또는 향후 "user").
//   UI 는 'admin' 과 그 외를 분기하므로 유니언으로 고정하지 않고 문자열로 둔다.
// - authorUsername 은 계정이 삭제되었을 경우 null 일 수 있다.
export interface FeatureRequestComment {
  id: number
  authorRole: string
  authorUsername: string | null
  authorDisplayName?: string | null
  authorGaName?: string | null
  authorId: string
  createdAt: string
  content: string
}

export async function submitFeatureRequest(
  token: string,
  payload: { content: string; title?: string; request_type?: FeatureRequestType },
) {
  const title = String(payload.title ?? '').trim()
  const content = String(payload.content ?? '').trim()
  const requestType = payload.request_type ?? 'feature'
  return apiRequest<{ id: number; created_at: string }>('/api/feature-request', {
    method: 'POST',
    token,
    body: JSON.stringify({
      content,
      request_type: requestType,
      ...(title ? { title } : {}),
    }),
  })
}

export interface MyFeatureRequestRow {
  id: number
  title: string
  content: string
  status: FeatureRequestStatus
  request_type: FeatureRequestType
  created_at: string
  comment_count: number
}

export async function listMyFeatureRequests(token: string): Promise<MyFeatureRequestRow[]> {
  return apiRequest<MyFeatureRequestRow[]>('/api/feature-requests/my', { method: 'GET', token })
}

export async function deleteMyFeatureRequest(token: string, id: number): Promise<void> {
  await apiRequest<undefined>(`/api/feature-requests/my/${id}`, { method: 'DELETE', token })
}

// 요청자 본인이 자신의 요청에 달린 댓글을 지연 로딩한다.
// 목록 API 의 comment_count 는 존재만 알려주고, 실제 본문은 사용자가 펼칠 때만 가져온다.
export async function listMyFeatureRequestComments(
  token: string,
  id: number,
): Promise<FeatureRequestComment[]> {
  return apiRequest<FeatureRequestComment[]>(`/api/feature-requests/my/${id}/comments`, {
    method: 'GET',
    token,
  })
}

export async function listFeatureRequestsAdmin(token: string): Promise<FeatureRequestAdminRow[]> {
  return apiRequest<FeatureRequestAdminRow[]>('/api/admin/feature-requests', { method: 'GET', token })
}

// 관리자 전용: 특정 요청에 달린 모든 댓글.
export async function listAdminFeatureRequestComments(
  token: string,
  id: number,
): Promise<FeatureRequestComment[]> {
  return apiRequest<FeatureRequestComment[]>(`/api/admin/feature-requests/${id}/comments`, {
    method: 'GET',
    token,
  })
}

// 관리자 전용: 새 답변 등록. 서버가 author_role='admin' 과 작성자 정보를 기록한다.
export async function createAdminFeatureRequestComment(
  token: string,
  id: number,
  content: string,
): Promise<FeatureRequestComment> {
  return apiRequest<FeatureRequestComment>(`/api/admin/feature-requests/${id}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ content }),
  })
}

export async function updateFeatureRequestStatus(
  token: string,
  id: number,
  status: FeatureRequestStatus,
) {
  return apiRequest<{
    id: number
    ga_id: number
    user_id: string
    title: string
    content: string
    status: FeatureRequestStatus
    created_at: string
  }>(`/api/admin/feature-requests/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  })
}
