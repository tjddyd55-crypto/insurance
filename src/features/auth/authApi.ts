import { apiRequest } from '../../lib/apiClient'

export interface AuthUser {
  id: string
  username: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export async function register(username: string, password: string) {
  return apiRequest<{ id: string; username: string; createdAt: string }>('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function login(username: string, password: string) {
  return apiRequest<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}
