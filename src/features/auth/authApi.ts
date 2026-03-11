import { ApiError, apiRequest } from '../../lib/apiClient'

export interface AuthUser {
  id: string
  username: string
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
