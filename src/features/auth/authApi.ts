import { ApiError, apiRequest } from '../../lib/apiClient'

export type UserRole = 'super_admin' | 'staff' | 'user'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export async function register(username: string, password: string) {
  try {
    return await apiRequest<{ id: string; username: string; createdAt: string }>('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('이미 사용 중인 아이디입니다.')
    }
    throw error
  }
}

export async function login(username: string, password: string) {
  return apiRequest<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export interface CreateStaffResponse {
  success: boolean
  data: {
    id: string
    username: string
    role: 'staff'
    displayName: string
  }
}

export async function createStaffAccount(
  token: string,
  payload: { username: string; password: string; name?: string },
) {
  try {
    return await apiRequest<CreateStaffResponse>('/api/admin/create-staff', {
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
