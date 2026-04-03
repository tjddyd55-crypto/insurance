import { ApiError, apiRequest } from '../../lib/apiClient'

export type UserRole = 'SUPER_ADMIN' | 'GA_ADMIN' | 'GA_STAFF' | 'USER'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  gaId: number
  /** ga_companies.code (대문자). 구세션·JWT에는 없을 수 있음 → 빈 문자열 */
  gaCode: string
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    username: string
    role: UserRole
    ga_id: number | null
    ga_code?: string
  }
}

export interface GaCompanyRow {
  id: number
  name: string
  code: string
  created_at: string
}

export async function listGaCompanies(): Promise<GaCompanyRow[]> {
  return apiRequest<GaCompanyRow[]>('/api/admin/ga', { method: 'GET' })
}

export async function register(username: string, password: string, gaId: number) {
  try {
    return await apiRequest<{ id: string; username: string; ga_id: number; createdAt: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, ga_id: gaId }),
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
  ga_company_name: string
  username: string
  role: UserRole
  created_at: string
}

export async function listAdminUsers(token: string, gaId?: number): Promise<AdminUserRow[]> {
  const qs = gaId != null && Number.isInteger(gaId) ? `?ga_id=${encodeURIComponent(String(gaId))}` : ''
  return apiRequest<AdminUserRow[]>(`/api/admin/users${qs}`, { method: 'GET', token })
}

export async function createGaCompany(token: string, payload: { name: string; code: string }) {
  return apiRequest<GaCompanyRow>('/api/admin/ga', {
    method: 'POST',
    token,
    body: JSON.stringify({ name: payload.name.trim(), code: payload.code.trim().toUpperCase() }),
  })
}

export type FeatureRequestStatus = 'pending' | 'reviewed' | 'done'

export interface FeatureRequestAdminRow {
  id: number
  ga_id: number
  ga_name: string
  username: string
  content: string
  status: FeatureRequestStatus
  created_at: string
}

export async function submitFeatureRequest(token: string, content: string) {
  return apiRequest<{ id: number; created_at: string }>('/api/feature-request', {
    method: 'POST',
    token,
    body: JSON.stringify({ content: content.trim() }),
  })
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
    content: string
    status: FeatureRequestStatus
    created_at: string
  }>(`/api/admin/feature-requests/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  })
}
