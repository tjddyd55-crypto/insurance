import { apiRequest, resolveApiUrl, ApiError } from '../../../lib/apiClient'
import type { PdfFieldSpec, PdfSourceFileMetadata } from '../../pdf-engine/types'

export type InsuranceClaimCompanyType = 'life' | 'non_life' | 'mutual' | 'other'
export type InsuranceClaimDocumentType = 'claim_form' | 'consent_form' | 'extra_form'

export type InsuranceClaimCompanySummary = {
  id: number
  companyName: string
  companyType: InsuranceClaimCompanyType
  faxNumber: string
  displayOrder: number
  isActive: boolean
  memo: string
  claimFormConfigured: boolean
  consentFormConfigured: boolean
  coordinatesConfigured: boolean
  createdAt?: string
  updatedAt?: string
}

export type InsuranceClaimDocumentSummary = {
  id: number
  insuranceCompanyId: number
  documentType: InsuranceClaimDocumentType
  title: string
  fileName: string
  storageKey: string
  pageCount: number
  sourcePdfMetadata: PdfSourceFileMetadata[] | null
  isActive: boolean
  fieldCount: number
  createdAt?: string
  updatedAt?: string
}

function authHeader(token: string) {
  return token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}
}

export async function listInsuranceClaimCompanies(
  token: string,
  options?: { includeInactive?: boolean },
): Promise<{ companies: InsuranceClaimCompanySummary[] }> {
  const q = options?.includeInactive === false ? '?includeInactive=false' : ''
  return apiRequest(`/api/admin/insurance-claim/companies${q}`, { token })
}

export async function createInsuranceClaimCompany(
  token: string,
  body: {
    companyName: string
    companyType: InsuranceClaimCompanyType
    faxNumber?: string
    displayOrder?: number
    isActive?: boolean
    memo?: string
  },
): Promise<{ company: InsuranceClaimCompanySummary }> {
  return apiRequest('/api/admin/insurance-claim/companies', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  })
}

export async function getInsuranceClaimCompany(
  token: string,
  companyId: number,
): Promise<{ company: InsuranceClaimCompanySummary; documents: InsuranceClaimDocumentSummary[] }> {
  return apiRequest(`/api/admin/insurance-claim/companies/${companyId}`, { token })
}

export async function patchInsuranceClaimCompany(
  token: string,
  companyId: number,
  body: Partial<{
    companyName: string
    companyType: InsuranceClaimCompanyType
    faxNumber: string
    displayOrder: number
    isActive: boolean
    memo: string
  }>,
): Promise<{ company: InsuranceClaimCompanySummary }> {
  return apiRequest(`/api/admin/insurance-claim/companies/${companyId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  })
}

export async function uploadInsuranceClaimDocument(
  token: string,
  companyId: number,
  input: { documentType: InsuranceClaimDocumentType; title?: string; files: File[] },
): Promise<{
  document: InsuranceClaimDocumentSummary
  pageCount: number
  sourcePdfMetadata?: PdfSourceFileMetadata[]
}> {
  if (!input.files.length) {
    throw new ApiError('PDF 파일이 필요합니다.', 400)
  }
  const fd = new FormData()
  for (const file of input.files) {
    fd.append('pdf', file)
  }
  fd.append('documentType', input.documentType)
  if (input.title?.trim()) {
    fd.append('title', input.title.trim())
  }
  const res = await fetch(resolveApiUrl(`/api/admin/insurance-claim/companies/${companyId}/documents/upload`), {
    method: 'POST',
    headers: { ...authHeader(token) },
    body: fd,
  })
  const payload = (await res.json().catch(() => ({}))) as {
    document?: InsuranceClaimDocumentSummary
    pageCount?: number
    sourcePdfMetadata?: PdfSourceFileMetadata[]
    message?: string
  }
  if (!res.ok || !payload.document) {
    throw new ApiError(payload.message ?? 'PDF 업로드 실패', res.status)
  }
  return {
    document: payload.document,
    pageCount: Number(payload.pageCount) || payload.document.pageCount,
    sourcePdfMetadata: Array.isArray(payload.sourcePdfMetadata) ? payload.sourcePdfMetadata : undefined,
  }
}

export async function getInsuranceClaimDocument(
  token: string,
  documentId: number,
): Promise<{ document: InsuranceClaimDocumentSummary; fields: PdfFieldSpec[] }> {
  return apiRequest(`/api/admin/insurance-claim/documents/${documentId}`, { token })
}

export async function saveInsuranceClaimDocumentFields(
  token: string,
  documentId: number,
  fields: PdfFieldSpec[],
): Promise<{ fields: PdfFieldSpec[] }> {
  return apiRequest(`/api/admin/insurance-claim/documents/${documentId}/fields`, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
    token,
  })
}

export async function fetchInsuranceClaimDocumentFile(token: string, documentId: number): Promise<ArrayBuffer> {
  const res = await fetch(resolveApiUrl(`/api/admin/insurance-claim/documents/${documentId}/file`), {
    headers: { ...authHeader(token) },
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string }
    throw new ApiError(payload.message ?? 'PDF를 불러오지 못했습니다.', res.status)
  }
  return res.arrayBuffer()
}
