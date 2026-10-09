import { ApiError, apiRequest } from '../../lib/apiClient'
import type { InsurerManager, InsurerManagerStatus, InsurerManagerType } from './types'

export type InsurerManagerCompanyChoice = {
  id: number
  name: string
  category: 'LIFE' | 'NON_LIFE'
}

/** 원수사 담당자 등록 — 플랫폼 공통 보험회사 카탈로그(영진 마스터 SSOT) + 자기 GA master id */
export async function listInsurerManagerCompanyChoicesApi(token: string): Promise<InsurerManagerCompanyChoice[]> {
  return apiRequest<InsurerManagerCompanyChoice[]>('/api/insurer-managers/company-choices', {
    method: 'GET',
    token,
  })
}

export async function listInsurerManagersApi(token: string): Promise<InsurerManager[]> {
  return apiRequest<InsurerManager[]>('/api/insurer-managers', { method: 'GET', token })
}

export async function createInsurerManagerApi(
  token: string,
  payload: {
    insurerType: InsurerManagerType
    companyId: number
    username: string
    password: string
  },
): Promise<InsurerManager> {
  try {
    return await apiRequest<InsurerManager>('/api/insurer-managers', {
      method: 'POST',
      token,
      body: JSON.stringify({
        insurerType: payload.insurerType,
        companyId: payload.companyId,
        username: payload.username.trim(),
        password: payload.password,
      }),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error(error.message || '등록할 수 없습니다.')
    }
    throw error
  }
}

export async function patchInsurerManagerApi(
  token: string,
  id: string,
  payload: {
    insurerType?: InsurerManagerType
    companyId?: number
    username?: string
    password?: string
    status?: InsurerManagerStatus
  },
): Promise<InsurerManager> {
  try {
    const body: Record<string, unknown> = {}
    if (payload.insurerType != null) {
      body.insurerType = payload.insurerType
    }
    if (payload.companyId != null && Number.isFinite(payload.companyId)) {
      body.companyId = payload.companyId
    }
    if (payload.username != null) {
      body.username = payload.username.trim()
    }
    if (payload.status != null) {
      body.status = payload.status
    }
    if (payload.password != null && payload.password.trim() !== '') {
      body.password = payload.password
    }
    return await apiRequest<InsurerManager>(`/api/insurer-managers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error(error.message || '수정할 수 없습니다.')
    }
    throw error
  }
}

export async function deleteInsurerManagerApi(token: string, id: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/api/insurer-managers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token,
  })
}
