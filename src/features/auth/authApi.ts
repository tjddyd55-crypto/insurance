import { ApiError, apiRequest } from '../../lib/apiClient'

export type UserRole = 'SUPER_ADMIN' | 'GA_ADMIN' | 'GA_STAFF' | 'USER'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  gaId: number
  /** ga_companies.code (대문자). 구세션·JWT에는 없을 수 있음 → 빈 문자열 */
  gaCode: string
  /** ga_companies.name (표시용). 구세션에는 없을 수 있음 */
  gaName: string
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    username: string
    role: UserRole
    ga_id: number | null
    ga_code?: string
    ga_name?: string
  }
}

export type EntityStatus = 'active' | 'blocked' | 'inactive'

export interface GaCompanyRow {
  id: number
  name: string
  code: string
  status: EntityStatus
  created_at: string
}

export async function listGaCompanies(token: string): Promise<GaCompanyRow[]> {
  return apiRequest<GaCompanyRow[]>('/api/admin/ga', { method: 'GET', token })
}

export async function register(username: string, password: string, inviteCode: string) {
  try {
    return await apiRequest<{ id: string; username: string; ga_id: number; createdAt: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          invite_code: inviteCode.trim(),
        }),
      },
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

export async function login(username: string, password: string) {
  const raw = await apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  const gaCode =
    typeof raw.user.ga_code === 'string' ? raw.user.ga_code.trim().toUpperCase() : ''
  const gaName = typeof raw.user.ga_name === 'string' ? raw.user.ga_name.trim() : ''
  const gaId =
    typeof raw.user.ga_id === 'number' && Number.isInteger(raw.user.ga_id) && raw.user.ga_id > 0
      ? raw.user.ga_id
      : 0
  return {
    token: raw.token,
    user: {
      id: raw.user.id,
      username: raw.user.username,
      role: raw.user.role,
      gaId,
      gaCode,
      gaName,
    },
  } satisfies { token: string; user: AuthUser }
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
  role: UserRole
  status: EntityStatus
  created_at: string
}

export async function listAdminUsers(token: string, gaId?: number): Promise<AdminUserRow[]> {
  const qs = gaId != null && Number.isInteger(gaId) ? `?ga_id=${encodeURIComponent(String(gaId))}` : ''
  return apiRequest<AdminUserRow[]>(`/api/admin/users${qs}`, { method: 'GET', token })
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
  return apiRequest<GaCompanyRow>('/api/admin/ga', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: payload.name.trim(), code: payload.code.trim().toUpperCase() }),
  })
}

export async function patchGaCompany(
  token: string,
  id: number,
  body: { name?: string; code?: string; status?: EntityStatus },
) {
  return apiRequest<GaCompanyRow>(`/api/admin/ga/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function deleteGaCompany(token: string, id: number): Promise<void> {
  await apiRequest<unknown>(`/api/admin/ga/${id}`, {
    method: 'DELETE',
    token,
  })
}

export type FeatureRequestStatus = 'pending' | 'reviewed' | 'done'

export interface FeatureRequestAdminRow {
  id: number
  ga_id: number
  ga_name: string
  username: string
  title: string
  content: string
  status: FeatureRequestStatus
  created_at: string
}

export async function submitFeatureRequest(
  token: string,
  payload: { content: string; title?: string },
) {
  const title = String(payload.title ?? '').trim()
  const content = String(payload.content ?? '').trim()
  return apiRequest<{ id: number; created_at: string }>('/api/feature-request', {
    method: 'POST',
    token,
    body: JSON.stringify({
      content,
      ...(title ? { title } : {}),
    }),
  })
}

export interface MyFeatureRequestRow {
  id: number
  title: string
  content: string
  status: FeatureRequestStatus
  created_at: string
}

export async function listMyFeatureRequests(token: string): Promise<MyFeatureRequestRow[]> {
  return apiRequest<MyFeatureRequestRow[]>('/api/feature-requests/my', { method: 'GET', token })
}

export async function listFeatureRequestsAdmin(token: string): Promise<FeatureRequestAdminRow[]> {
  return apiRequest<FeatureRequestAdminRow[]>('/api/admin/feature-requests', { method: 'GET', token })
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
