import { apiRequest, resolveApiUrl, ApiError } from '../../../lib/apiClient'

function lc(code: string) {
  return encodeURIComponent(String(code ?? '').trim())
}

/** 공개 계약 플로우는 세션/장치 바인딩 쿠키 동반 요청이 필요하다. */
type PublicMutationInit = Parameters<typeof apiRequest>[1]

function publicRequest<T>(path: string, init?: PublicMutationInit): Promise<T> {
  return apiRequest<T>(path, { ...init, credentials: 'include' })
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
  /** 터미널 상태일 때만: 취소 vs 만료 구분 (구 클라이언트 호환: 없으면 undefined) */
  blockedReason?: 'cancelled' | 'expired' | null
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
  return publicRequest<ContractPublicSessionPayload>(`/api/contracts/public/${lc(linkCode)}`)
}

export async function postContractPublicOpen(linkCode: string): Promise<{ opened: boolean; metaRecorded?: boolean }> {
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/open`, {
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
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/documents`)
}

export async function postContractOtpSend(linkCode: string): Promise<{
  identitySessionId?: string
  maskedPhone?: string | null
  expiresInSeconds?: number
}> {
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/otp/send`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function postContractOtpVerify(linkCode: string, code: string): Promise<{ verified?: boolean; status?: string }> {
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ code: String(code ?? '').replace(/\D/g, '').slice(0, 6) }),
  })
}

export async function fetchContractOtpStatus(linkCode: string): Promise<{
  verified: boolean
  sendSessionStatus: string
  maskedPhone: string | null
}> {
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/otp/status`)
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
    /** 고객 입력 단계에서 입력칸으로 쓰지 않음(sender·고정 출력 등) */
    hideFromCustomerInput?: boolean
    /** 서버 정규화된 입력 주체(고객·설계사 등) */
    inputRole?: string
    /** 고객 화면에서 설계사(sender)가 넣은 값 — 읽기 전용 */
    readOnlyCustomerUi?: boolean
    suggestedDefault?: string | null
    publicValue?: ContractPublicFieldValue | null
  }[]
  pdfPreviewUrl: string
  signedPdfDownloadPath?: string | null
  /** false 이면 경로가 있어도 합성 미완료로 간주 */
  signedPdfDownloadAvailable?: boolean
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
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}`)
}

export function resolveContractPdfPreviewAbsUrl(linkCode: string, documentInstanceId: string): string {
  return resolveApiUrl(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/pdf`)
}

export type ContractRenderedPdfMode = 'input' | 'final'

export function resolveContractRenderedPdfAbsUrl(
  linkCode: string,
  documentInstanceId: string,
  mode: ContractRenderedPdfMode = 'final',
): string {
  const base = resolveApiUrl(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/rendered-pdf`)
  const q = mode === 'input' ? '?mode=input' : '?mode=final'
  return `${base}${q}`
}

export function resolveContractSignedPdfAbsUrl(linkCode: string, documentInstanceId: string): string {
  return resolveApiUrl(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/signed-pdf`)
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
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/values`, {
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
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/sign`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postContractPublicDocumentComplete(
  linkCode: string,
  documentInstanceId: string,
  body: {
    acknowledgeElectronicContract: true
    finalPreviewConfirmed: true
    finalSubmitAcknowledged: true
  },
): Promise<{
  status?: string
  completed?: boolean
  evidenceSummary?: ContractDocumentDetailPayload['evidenceSummary']
  signedPdfDownloadAvailable?: boolean
  signedPdfDownloadPath?: string
}> {
  return publicRequest(`/api/contracts/public/${lc(linkCode)}/documents/${lc(documentInstanceId)}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type ContractPublicMissingField = {
  fieldId: string
  fieldKey: string
  fieldLabel: string
  fieldType: string
}

export { ApiError }

function isLikelyInternalErrorMessage(message: string): boolean {
  const u = message.toUpperCase()
  return (
    u.includes('DB_ERROR') ||
    u.includes('DATABASE') ||
    u.includes('ECONN') ||
    u.includes('ETIMEDOUT') ||
    u.includes('SQL') ||
    u.includes('NAMESPACE') ||
    u.includes('PG::')
  )
}

const PUBLIC_ACTION_CODE_MESSAGES: Record<string, string> = {
  missing_signature_acknowledgement: '전자서명 진술에 동의해 주세요.',
  invalid_signature_payload: '유효한 서명 이미지가 아닙니다. 다시 서명해 주세요.',
  invalid_signature_field: '서명 필드가 올바르지 않습니다.',
  signature_upload_failed: '서명 이미지를 저장소에 올리지 못했습니다. 잠시 후 다시 시도해 주세요.',
  signature_file_insert_failed: '서명 파일 정보를 저장하지 못했습니다. 담당자에게 문의해 주세요.',
  signature_file_constraint_failed: '서명 저장이 서버 정책과 맞지 않습니다. 담당자에게 문의해 주세요.',
  signature_reference_violation: '서명 저장에 필요한 정보가 부족합니다. 담당자에게 문의해 주세요.',
  signature_file_owner_missing: '서명 저장에 필요한 배포 설정이 누락되었습니다. 담당자에게 문의해 주세요.',
  signature_save_failed: '전자서명 저장 중 오류가 발생했습니다. 다시 시도해 주세요.',
  required_fields_missing: '필수 항목을 모두 입력·서명해야 합니다.',
  final_preview_required: '최종 문서 확인 단계를 먼저 완료해 주세요.',
  final_submit_ack_required: '최종 전송 확인에 동의해 주세요.',
}

const SIGN_FALLBACK = '전자서명 저장 중 오류가 발생했습니다. 다시 시도해 주세요.'
const COMPLETE_FALLBACK = '문서 완료 처리 중 오류가 발생했습니다. 다시 시도해 주세요.'
const GENERIC_FALLBACK = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'

/** 공개 계약 API 오류 → 사용자용 문구 (민감 정보·내부 메시지 노출 방지) */
export function formatContractPublicActionError(
  e: unknown,
  ctx?: 'sign' | 'complete' | 'values',
): string {
  if (e instanceof ApiError) {
    const byCode = e.code ? PUBLIC_ACTION_CODE_MESSAGES[e.code] : undefined
    if (byCode) {
      return byCode
    }
    if (e.status >= 500) {
      if (ctx === 'complete') {
        return COMPLETE_FALLBACK
      }
      if (ctx === 'sign') {
        return SIGN_FALLBACK
      }
      return GENERIC_FALLBACK
    }
    const msg = (e.message ?? '').trim()
    if (msg && !isLikelyInternalErrorMessage(msg)) {
      return msg
    }
    if (isLikelyInternalErrorMessage(msg)) {
      if (ctx === 'complete') {
        return COMPLETE_FALLBACK
      }
      if (ctx === 'sign') {
        return SIGN_FALLBACK
      }
      return GENERIC_FALLBACK
    }
    if (ctx === 'complete') {
      return COMPLETE_FALLBACK
    }
    if (ctx === 'sign') {
      return SIGN_FALLBACK
    }
    return GENERIC_FALLBACK
  }
  return GENERIC_FALLBACK
}

/** 문서 완료: 누락 필드 상세 + 안전한 폴백 */
export function formatContractPublicCompleteError(e: unknown): string {
  if (e instanceof ApiError && e.code === 'required_fields_missing') {
    const pack = e.data as { missingFields?: ContractPublicMissingField[] } | undefined
    const labels =
      pack?.missingFields
        ?.map((m) => String(m.fieldLabel || m.fieldKey || m.fieldId || '').trim())
        .filter((s) => s.length > 0) ?? []
    if (labels.length > 0) {
      return `누락된 항목: ${labels.join(', ')}`
    }
    return PUBLIC_ACTION_CODE_MESSAGES.required_fields_missing
  }
  return formatContractPublicActionError(e, 'complete')
}
