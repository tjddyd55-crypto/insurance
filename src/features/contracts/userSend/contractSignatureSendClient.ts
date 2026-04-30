import { ApiError, apiRequest } from '../../../lib/apiClient'
import type {
  CreateSendSessionResult,
  SendSessionDetail,
} from '../testConsole/contractSignatureTestConsoleClient'

export type UserContractTemplateItem = {
  id: string
  title: string
  description: string | null
  category: string | null
  status: string
  version: number
  pdfTemplateId: number | null
  pdfEngineTitle: string | null
  pdfFieldCount: number
  signatureFieldCount: number
  sendable: boolean
}

export type UserContractCustomerSearchHit = {
  id: number
  name: string
  customerCode: string | null
  maskedPhone: string
  hasPhone: boolean
}

export async function listUserContractTemplates(
  token: string,
): Promise<UserContractTemplateItem[]> {
  const body = await apiRequest<{ templates?: UserContractTemplateItem[] }>(
    '/api/contracts/templates',
    { method: 'GET', token },
  )
  const raw = body as { templates?: UserContractTemplateItem[] }
  if (!raw?.templates || !Array.isArray(raw.templates)) {
    throw new ApiError('템플릿 목록 응답 형식이 올바르지 않습니다.', 500)
  }
  return raw.templates
}

export async function searchCustomersForContractSend(
  token: string,
  q: string,
): Promise<UserContractCustomerSearchHit[]> {
  const qs = new URLSearchParams()
  if (q.trim()) {
    qs.set('q', q.trim())
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const body = await apiRequest<{ customers?: UserContractCustomerSearchHit[] }>(
    `/api/contracts/customers/search${suffix}`,
    { method: 'GET', token },
  )
  const raw = body as { customers?: UserContractCustomerSearchHit[] }
  if (!raw?.customers || !Array.isArray(raw.customers)) {
    throw new ApiError('고객 검색 응답 형식이 올바르지 않습니다.', 500)
  }
  return raw.customers
}

export async function createUserContractSendSession(
  token: string,
  params: { customerId: number; templateIds: string[] },
): Promise<CreateSendSessionResult> {
  const body = await apiRequest<{ sendSession?: CreateSendSessionResult }>(
    '/api/contracts/send-sessions',
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        customerId: params.customerId,
        templateIds: params.templateIds,
      }),
    },
  )
  const s = (body as { sendSession?: CreateSendSessionResult }).sendSession
  if (!s?.id || !s.linkCode) {
    throw new ApiError('발송 세션 생성 응답이 올바르지 않습니다.', 500)
  }
  return s
}

export async function getUserContractSendSessionDetail(
  token: string,
  sendSessionId: string,
): Promise<SendSessionDetail> {
  const body = await apiRequest<{ sendSession?: SendSessionDetail }>(
    `/api/contracts/send-sessions/${encodeURIComponent(sendSessionId)}`,
    { method: 'GET', token },
  )
  const s = (body as { sendSession?: SendSessionDetail }).sendSession
  if (!s?.id || !s.linkCode) {
    throw new ApiError('발송 세션 상세 응답이 올바르지 않습니다.', 500)
  }
  return s
}
