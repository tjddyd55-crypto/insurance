/**
 * 전자서명 테스트 콘솔 — 기존 관리자 계약 API만 어댑트. 비즈니스 로직 복사 없음.
 */
import { ApiError, apiRequest } from '../../../lib/apiClient'
import {
  getAdminPdfTemplate,
  getPdfTemplate,
  listAdminPdfTemplates,
  listPdfTemplates,
} from '../../pdf-engine/api/pdfTemplateApi'
import type { PdfTemplateDetail, PdfTemplateSummary } from '../../pdf-engine/types'
import { searchCustomers } from '../../customers/api/customersApi'
import type { CustomerRecord } from '../../customers/domain/types'

export type ContractTemplateListItem = {
  id: string
  title: string
  description: string | null
  category: string | null
  status: string
  version: number
  pdfTemplateId: number | null
  pdfEngineTitle: string | null
  pageCount: number | null
  gaId: number | null
  createdAt: string
  updatedAt: string
}

export type CreateSendSessionResult = {
  id: string
  linkCode: string
  customerId: number
  status: string
  maskedPhone: string
  documentCount: number
  createdAt: string
}

export type SendSessionEvidence = {
  documentInstanceId: string
  documentTitle: string | null
  status: string
  completedAt: string | null
  evidenceHash: string | null
  evidenceHashPrefix: string | null
  identityProvider: string
  identityLevel: string
  otpVerifiedAt: string | null
  signedAt: string | null
  hasSignatureFile: boolean
  hasSignedPdfFile: boolean
  hasSignedPdfHash: boolean
} | null

export type SendSessionDocumentDetail = {
  id: string
  templateId: string
  templateVersion: number
  titleSnapshot: string
  status: string
  sortOrder: number
  originalPdfHash: string | null
  createdAt: string
  completedAt: string | null
  evidence: SendSessionEvidence
}

export type SendSessionDetail = {
  id: string
  linkCode: string
  customerId: number
  packageId: string | null
  status: string
  maskedPhone: string
  identitySessionId: string | null
  sentByUserId: string | null
  sentAt: string | null
  createdAt: string
  completedAt: string | null
  documents: SendSessionDocumentDetail[]
}

function tenantQs(tenantGaId: number | null, isSuper: boolean): string {
  if (!isSuper || tenantGaId == null || !Number.isFinite(tenantGaId)) {
    return ''
  }
  const q = new URLSearchParams()
  q.set('tenant_ga_id', String(tenantGaId))
  return `?${q.toString()}`
}

function tenantBody(tenantGaId: number | null, isSuper: boolean): Record<string, number> {
  if (!isSuper || tenantGaId == null || !Number.isFinite(tenantGaId)) {
    return {}
  }
  return { tenant_ga_id: tenantGaId }
}

export async function listPdfTemplatesForContractTest(
  token: string,
  role: string | undefined,
): Promise<{ templates: PdfTemplateSummary[]; source: 'admin' | 'user' }> {
  if (role === 'SUPER_ADMIN') {
    const { templates } = await listAdminPdfTemplates(token)
    return { templates, source: 'admin' }
  }
  const { templates } = await listPdfTemplates(token)
  return { templates, source: 'user' }
}

export async function getPdfTemplateDetailForContractTest(
  token: string,
  role: string | undefined,
  id: number,
): Promise<PdfTemplateDetail> {
  if (role === 'SUPER_ADMIN') {
    return getAdminPdfTemplate(token, id)
  }
  return getPdfTemplate(token, id)
}

export function countPdfFieldStats(detail: PdfTemplateDetail): {
  fieldCount: number
  signatureCount: number
} {
  const fields = detail.fields ?? []
  let signatureCount = 0
  for (const f of fields) {
    const ft = (f as { fieldType?: string }).fieldType
    if (ft === 'signature') {
      signatureCount += 1
    }
  }
  return { fieldCount: fields.length, signatureCount }
}

export async function listContractTemplates(
  token: string,
  role: string | undefined,
  tenantGaId: number | null,
): Promise<ContractTemplateListItem[]> {
  const isSuper = role === 'SUPER_ADMIN'
  const qs = tenantQs(tenantGaId, isSuper)
  const body = await apiRequest<{ templates?: ContractTemplateListItem[] }>(
    `/api/admin/contracts/templates${qs}`,
    { method: 'GET', token },
  )
  const raw = body as { templates?: ContractTemplateListItem[] }
  if (!raw?.templates || !Array.isArray(raw.templates)) {
    throw new ApiError('계약 템플릿 목록 응답 형식이 올바르지 않습니다.', 500)
  }
  return raw.templates
}

export async function createContractTemplateFromPdfTemplate(
  token: string,
  role: string | undefined,
  params: { pdfTemplateId: number; pdfTitle: string; tenantGaId: number | null },
): Promise<string> {
  const isSuper = role === 'SUPER_ADMIN'
  const title = `[TEST] ${String(params.pdfTitle ?? '').trim() || '계약 템플릿'}`
  const body = await apiRequest<{ data?: { id?: string } }>(`/api/admin/contracts/templates`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      title,
      pdfTemplateId: params.pdfTemplateId,
      status: 'draft',
      description: '[TEST] 전자서명 테스트 콘솔에서 생성됨',
      ...tenantBody(params.tenantGaId, isSuper),
    }),
  })
  const id = (body as { data?: { id?: string } })?.data?.id
  if (!id || typeof id !== 'string') {
    throw new ApiError('계약 템플릿 생성 응답에 id가 없습니다.', 500)
  }
  return id
}

export async function activateContractTemplate(
  token: string,
  role: string | undefined,
  templateId: string,
  tenantGaId: number | null,
): Promise<void> {
  const isSuper = role === 'SUPER_ADMIN'
  const qs = tenantQs(tenantGaId, isSuper)
  await apiRequest(`/api/admin/contracts/templates/${encodeURIComponent(templateId)}/status${qs}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status: 'active', ...tenantBody(tenantGaId, isSuper) }),
  })
}

export async function searchCustomersForContractTest(
  token: string,
  q: string,
): Promise<CustomerRecord[]> {
  return searchCustomers(token, q)
}

export async function createContractSendSession(
  token: string,
  role: string | undefined,
  params: {
    customerId: number
    templateIds: string[]
    tenantGaId: number | null
  },
): Promise<CreateSendSessionResult> {
  const isSuper = role === 'SUPER_ADMIN'
  const body = await apiRequest<{ sendSession?: CreateSendSessionResult }>(
    `/api/admin/contracts/send-sessions`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        customerId: params.customerId,
        templateIds: params.templateIds,
        ...tenantBody(params.tenantGaId, isSuper),
      }),
    },
  )
  const s = (body as { sendSession?: CreateSendSessionResult }).sendSession
  if (!s?.id || !s.linkCode) {
    throw new ApiError('발송 세션 생성 응답이 올바르지 않습니다.', 500)
  }
  return s
}

export async function getContractSendSessionDetail(
  token: string,
  role: string | undefined,
  sendSessionId: string,
  tenantGaId: number | null,
): Promise<SendSessionDetail> {
  const isSuper = role === 'SUPER_ADMIN'
  const qs = tenantQs(tenantGaId, isSuper)
  const body = await apiRequest<{ sendSession?: SendSessionDetail }>(
    `/api/admin/contracts/send-sessions/${encodeURIComponent(sendSessionId)}${qs}`,
    { method: 'GET', token },
  )
  const s = (body as { sendSession?: SendSessionDetail }).sendSession
  if (!s?.id) {
    throw new ApiError('발송 세션 상세 응답이 올바르지 않습니다.', 500)
  }
  return s
}
