import { ApiError, apiRequest } from '../../../lib/apiClient'
import type {
  CompanyDirectoryEntry,
  CompanyUpdateHistoryItem,
  InsuranceCompanyContactDraft,
  InsuranceGeneralDraft,
} from '../domain/types'

export async function listCompanyDirectory(token: string): Promise<CompanyDirectoryEntry[]> {
  const rows = await apiRequest<CompanyDirectoryEntry[]>('/api/company/list', { token })
  if (import.meta.env.DEV) {
    const distinctCategories = [...new Set(rows.map((r) => r.category))].sort()
    const missingCategory = rows.filter((r) => !String(r.category ?? '').trim()).length
    // eslint-disable-next-line no-console -- 서버가 목록을 잘라 주는지·category 원문 분포 확인
    console.log('[company-registry] GET /api/company/list', {
      total: rows.length,
      missingCategory,
      categories: distinctCategories,
      rowCount: rows.length,
      distinctCategoryCount: distinctCategories.length,
      distinctCategories,
      sample: rows.slice(0, 8).map((r) => ({ name: r.name, category: r.category })),
    })
  }
  return rows
}

export async function getCompanyRecentUpdates(token: string): Promise<CompanyUpdateHistoryItem[]> {
  return apiRequest<CompanyUpdateHistoryItem[]>('/api/company/recent-updates', { token })
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
