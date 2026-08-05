/**
 * SUPER_ADMIN — ONE FC 프로그램 문의 관리 API 클라이언트.
 * 백엔드: `server/public-inquiries/registerPublicInquiryAdminApi.js`
 */

import { apiRequest } from '../../../lib/apiClient'

export type ProgramInquiryStatus = 'NEW' | 'CHECKING' | 'CONTACTED' | 'COMPLETED' | 'SPAM'

export type ProgramInquiryType =
  | 'FC_PERSONAL'
  | 'BRANCH_ADOPTION'
  | 'INSURER_NEWS'
  | 'CUSTOMER_APP'
  | 'PRICING'
  | 'FEATURE'
  | 'INSTALL'
  | 'OTHER'

export type ProgramInquiryAdminRow = {
  id: string
  inquiryType: ProgramInquiryType | string
  name: string
  phoneDisplay: string
  phoneNormalized: string
  organizationName: string | null
  email: string | null
  preferredContactTime: string | null
  message: string
  privacyConsent: boolean
  privacyConsentAt: string | null
  status: ProgramInquiryStatus | string
  adminMemo: string | null
  assignedAdminId: string | null
  assignedAdminName: string | null
  source: string
  createdAt: string
  updatedAt: string | null
  resolvedAt: string | null
  deletedAt: string | null
}

export type ProgramInquiryListParams = {
  status?: ProgramInquiryStatus | ''
  inquiryType?: ProgramInquiryType | ''
  q?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type ProgramInquiryListResult = {
  items: ProgramInquiryAdminRow[]
  total: number
  page: number
  pageSize: number
  newCount: number
}

export type ProgramInquiryPatchBody = {
  status?: ProgramInquiryStatus
  adminMemo?: string | null
  assignedAdminId?: string | null
  softDelete?: boolean
}

async function unwrapData<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<{ success?: boolean; data?: T; message?: string }>(path, {
    ...init,
    token,
  })
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data
  }
  return res as T
}

function buildQuery(params: ProgramInquiryListParams): string {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.inquiryType) sp.set('inquiryType', params.inquiryType)
  if (params.q?.trim()) sp.set('q', params.q.trim())
  if (params.from?.trim()) sp.set('from', params.from.trim())
  if (params.to?.trim()) sp.set('to', params.to.trim())
  if (params.page != null) sp.set('page', String(params.page))
  if (params.pageSize != null) sp.set('pageSize', String(params.pageSize))
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function listProgramInquiriesAdmin(
  token: string,
  params: ProgramInquiryListParams = {},
): Promise<ProgramInquiryListResult> {
  return unwrapData(token, `/api/admin/public-inquiries${buildQuery(params)}`)
}

export async function fetchProgramInquiryNewCount(token: string): Promise<number> {
  const data = await unwrapData<{ newCount: number }>(token, '/api/admin/public-inquiries/new-count')
  return Number(data.newCount ?? 0)
}

export async function getProgramInquiryAdmin(
  token: string,
  id: string,
): Promise<ProgramInquiryAdminRow> {
  return unwrapData(token, `/api/admin/public-inquiries/${encodeURIComponent(id)}`)
}

export async function patchProgramInquiryAdmin(
  token: string,
  id: string,
  body: ProgramInquiryPatchBody,
): Promise<ProgramInquiryAdminRow | { id: string; deleted: true }> {
  return unwrapData(token, `/api/admin/public-inquiries/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
