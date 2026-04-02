import { ApiError, apiRequest } from '../../../lib/apiClient'
import type {
  CompanyDirectoryEntry,
  CompanyRecentUpdate,
  InsuranceCompanyContactDraft,
  InsuranceGeneralDraft,
} from '../domain/types'

export async function listCompanyDirectory(): Promise<CompanyDirectoryEntry[]> {
  return apiRequest<CompanyDirectoryEntry[]>('/api/company/list')
}

export async function getCompanyRecentUpdates(): Promise<CompanyRecentUpdate[]> {
  return apiRequest<CompanyRecentUpdate[]>('/api/company/recent-updates')
}

export interface FullSaveCompanyBody {
  company: Record<string, unknown>
  contacts: InsuranceCompanyContactDraft[]
}

export async function fullSaveCompanyDirectory(
  body: FullSaveCompanyBody,
  token: string,
): Promise<{ success: boolean; data: CompanyDirectoryEntry | null }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ success: boolean; data: CompanyDirectoryEntry | null }>('/api/company/full-save', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function saveGeneralRequest(
  body: { company: { category: string; name: string }; general: InsuranceGeneralDraft },
  token: string,
): Promise<{ success: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ success: boolean }>('/api/company/general-save', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}
