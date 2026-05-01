import { apiRequest, resolveApiUrl, ApiError } from '../../../lib/apiClient'

function lc(code: string) {
  return encodeURIComponent(String(code ?? '').trim())
}

export type ContractPublicSendSession = {
  id: string
  status: string
  maskedPhone: string | null
  customerDisplayName: string
  identityVerified: boolean
  identityStatus: string | null
  authenticationRequired: boolean
  openedAt: string | null
}

export type ContractPublicSessionPayload = {
  sendSession: ContractPublicSendSession
  blocked: boolean
  completed: boolean
  documentCount: number
  completedDocumentCount: number
  allRequiredCompleted: boolean
  documents: {
    id: string
    title: string
    required: boolean
    sortOrder: number
    status: string
  }[]
}

export async function fetchContractPublicSession(linkCode: string): Promise<ContractPublicSessionPayload> {
  return apiRequest<ContractPublicSessionPayload>(`/api/contracts/public/${lc(linkCode)}`)
}

export async function postContractPublicOpen(linkCode: string): Promise<{ opened: boolean; metaRecorded?: boolean }> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/open`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export type ContractDocumentRow = {
  id: string
  title: string
  required: boolean
  sortOrder: number
  status: string
}

export async function fetchContractPublicDocuments(linkCode: string): Promise<{ documents: ContractDocumentRow[] }> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/documents`)
}

export async function postContractOtpSend(linkCode: string): Promise<{
  identitySessionId?: string
  maskedPhone?: string | null
  expiresInSeconds?: number
}> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/otp/send`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function postContractOtpVerify(linkCode: string, code: string): Promise<{ verified?: boolean; status?: string }> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ code: String(code ?? '').replace(/\D/g, '').slice(0, 6) }),
  })
}

export async function fetchContractOtpStatus(linkCode: string): Promise<{
  verified: boolean
  sendSessionStatus: string
  maskedPhone: string | null
}> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/otp/status`)
}

export type ContractPublicFieldValue =
  | { kind: 'text'; value: string }
  | { kind: 'radio'; value: string }
  | { kind: 'checkbox'; checked: boolean }
  | { kind: 'signature'; signed: boolean }

export type ContractDocumentDetailPayload = {
  document: {
    id: string
    templateId: string
    title: string
    status: string
    required: boolean
    sortOrder: number
    pdfTemplateId: number | null
    templateVersion: number | null
    originalPdfHash: string | null
  }
  pdfTemplate: {
    id: number
    code: string
    title: string
    description: string
    pageCount: number
    isActive: boolean
  } | null
  fields: {
    id: string
    fieldKey: string
    label: string
    fieldType: string
    required: boolean
    orderIndex: number
    placements: unknown
    options: unknown
    customerMapping?: string | null
    suggestedDefault?: string | null
    publicValue?: ContractPublicFieldValue | null
  }[]
  pdfPreviewUrl: string
  notice?: string
  canEdit?: boolean
  evidenceSummary?: {
    authenticationLabel: string
    evidenceHashPrefix: string
    signedAt: string | null
    completedAt?: string
  }
}

export async function fetchContractPublicDocumentDetail(
  linkCode: string,
  documentInstanceId: string,
): Promise<ContractDocumentDetailPayload> {
  return apiRequest(
    `/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}`,
  )
}

export function resolveContractPdfPreviewAbsUrl(linkCode: string, documentInstanceId: string): string {
  return resolveApiUrl(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/pdf`)
}

export type ContractPublicValueInput = {
  fieldId: number | string
  fieldKey: string
  value: string | boolean
}

export async function postContractPublicDocumentValues(
  linkCode: string,
  documentInstanceId: string,
  values: ContractPublicValueInput[],
): Promise<{ saved?: boolean }> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/values`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  })
}

export async function postContractPublicDocumentSign(
  linkCode: string,
  documentInstanceId: string,
  body: {
    signatureImageData: string
    fieldId?: number | string
    electronicSignAcknowledged: true
  },
): Promise<{ fieldId?: string; valueHash?: string; fileId?: string }> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/sign`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postContractPublicDocumentComplete(
  linkCode: string,
  documentInstanceId: string,
  body: { acknowledgeElectronicContract: true },
): Promise<{
  completed?: boolean
  evidenceSummary?: ContractDocumentDetailPayload['evidenceSummary']
}> {
  return apiRequest(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export { ApiError }

const PUBLIC_SIGN_CODE_MESSAGES: Record<string, string> = {
  missing_signature_acknowledgement: '전자서명 진술에 동의해 주세요.',
  invalid_signature_payload: '유효한 서명 이미지가 아닙니다. 다시 서명해 주세요.',
  invalid_signature_field: '서명 필드가 올바르지 않습니다.',
  signature_upload_failed: '서명 이미지를 저장소에 올리지 못했습니다. 잠시 후 다시 시도해 주세요.',
  signature_file_insert_failed: '서명 파일 정보를 저장하지 못했습니다. 담당자에게 문의해 주세요.',
  signature_file_constraint_failed: '서명 저장이 서버 정책과 맞지 않습니다. 담당자에게 문의해 주세요.',
  signature_reference_violation: '서명 저장에 필요한 정보가 부족합니다. 담당자에게 문의해 주세요.',
  signature_file_owner_missing: '서명 저장에 필요한 배포 설정이 누락되었습니다. 담당자에게 문의해 주세요.',
  signature_save_failed: '전자서명 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

/** 공개 계약 API 오류 → 사용자용 문구 (민감 정보 없음) */
export function formatContractPublicActionError(e: unknown): string {
  if (e instanceof ApiError) {
    const byCode = e.code ? PUBLIC_SIGN_CODE_MESSAGES[e.code] : undefined
    if (byCode) {
      return byCode
    }
    if (e.message === 'DB_ERROR' || e.message.includes('DB_ERROR')) {
      return '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    }
    return e.message
  }
  return '요청 처리에 실패했습니다.'
}
