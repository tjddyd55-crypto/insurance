import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import { downloadBlobFile, parseContentDispositionFilename } from '../../../utils/downloadBlobFile'

export type ClaimAttachmentMetadata = {
  storageKey: string
  fileName: string
  contentType: string
  size: number
  uploadedAt: string
}

export type ClaimSignatureMetadata = {
  storageKey: string
  fileName: string
  contentType: string
  size: number
  signedAt: string
}

export type ClaimSignatureData = {
  insuredSignature?: ClaimSignatureMetadata | null
  contractorSignature?: ClaimSignatureMetadata | null
}

export type CustomerClaimAppAttachment = {
  id: number
  fileName: string
  contentType: string
  fileSize: number
  uploadedAt: string | null
  requestId: number
  requestTitle: string
}

export type ClaimRequestDraft = {
  id: number
  customerId: number | null
  insuranceCompanyId: number
  insuranceCompanyName?: string | null
  status: string
  insuredSnapshot: Record<string, string>
  contractorSnapshot: Record<string, string> | null
  contractorSameAsInsured: boolean
  claimData: Record<string, string>
  paymentData: Record<string, string>
  signatureData: ClaimSignatureData
  selectedCustomerAttachmentIds: number[]
  additionalAttachmentMetadata: ClaimAttachmentMetadata[]
  sourceClaimRequestId: number | null
  createdAt?: string
  updatedAt?: string
}

export type ClaimCompany = {
  id: number
  companyName: string
  faxNumber: string
  companyType?: 'life' | 'non_life' | 'mutual' | 'other'
}

export type ClaimDraftPayload = Omit<
  ClaimRequestDraft,
  'id' | 'status' | 'sourceClaimRequestId' | 'insuranceCompanyName' | 'insuranceCompanyId' | 'createdAt' | 'updatedAt'
>

function authHeader(token: string) {
  const bearer = token.trim()
  return bearer ? { Authorization: `Bearer ${bearer}` } : {}
}

export async function listClaimCompanies(token: string) {
  return apiRequest<{ companies: ClaimCompany[] }>('/api/insurance-claim/companies', { token })
}

export async function createClaimDraft(token: string, body: ClaimDraftPayload & { insuranceCompanyId: number }) {
  return apiRequest<{ request: ClaimRequestDraft }>('/api/insurance-claim/requests', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function createClaimDraftsBatch(token: string, body: ClaimDraftPayload, insuranceCompanyIds: number[]) {
  return apiRequest<{ requests: ClaimRequestDraft[] }>('/api/insurance-claim/requests/batch', {
    method: 'POST',
    token,
    body: JSON.stringify({ ...body, insuranceCompanyIds }),
  })
}

export async function getClaimRequest(token: string, id: number) {
  return apiRequest<{ request: ClaimRequestDraft }>(`/api/insurance-claim/requests/${id}`, { token })
}

export async function updateClaimDraft(
  token: string,
  id: number,
  body: ClaimDraftPayload & { insuranceCompanyId: number },
) {
  return apiRequest<{ request: ClaimRequestDraft }>(`/api/insurance-claim/requests/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function listClaimRequests(token: string) {
  return apiRequest<{ requests: ClaimRequestDraft[] }>('/api/insurance-claim/requests', { token })
}

export async function deleteClaimRequest(token: string, id: number) {
  return apiRequest<{ success: boolean }>(`/api/insurance-claim/requests/${id}`, {
    method: 'DELETE',
    token,
  })
}

export async function duplicateClaimRequest(token: string, id: number) {
  return apiRequest<{ request: ClaimRequestDraft }>(`/api/insurance-claim/requests/${id}/duplicate`, {
    method: 'POST',
    token,
  })
}

export async function generateClaimDocuments(token: string, id: number) {
  return apiRequest<{ request: ClaimRequestDraft }>(`/api/insurance-claim/requests/${id}/generate`, {
    method: 'POST',
    token,
  })
}

export function buildClaimDownloadUrl(id: number) {
  return resolveApiUrl(`/api/insurance-claim/requests/${id}/download`)
}

export async function downloadClaimBundle(token: string, id: number): Promise<void> {
  if (!token.trim()) {
    throw new Error('로그인이 필요합니다.')
  }
  const response = await fetch(buildClaimDownloadUrl(id), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token.trim()}` },
  })
  if (!response.ok) {
    let message = 'ZIP 다운로드에 실패했습니다.'
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message?.trim()) {
        message = payload.message.trim()
      }
    } catch {
      // ignore non-json body
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const fileName =
    parseContentDispositionFilename(response.headers.get('Content-Disposition')) ?? `insurance-claim-${id}.zip`
  downloadBlobFile({ blob, fileName })
}

export async function listCustomerClaimAppAttachments(token: string, customerId: number) {
  return apiRequest<{ attachments: CustomerClaimAppAttachment[] }>(
    `/api/insurance-claim/customers/${customerId}/app-attachments`,
    { token },
  )
}

export async function uploadClaimAttachment(token: string, requestId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(resolveApiUrl(`/api/insurance-claim/requests/${requestId}/attachments/upload`), {
    method: 'POST',
    headers: { ...authHeader(token) },
    body: form,
  })
  const payload = (await response.json().catch(() => ({}))) as {
    attachment?: ClaimAttachmentMetadata
    message?: string
  }
  if (!response.ok || !payload.attachment) {
    throw new Error(payload.message ?? '첨부파일 업로드에 실패했습니다.')
  }
  return payload
}

export async function uploadClaimSignature(
  token: string,
  requestId: number,
  role: 'insured' | 'contractor',
  file: File | Blob,
  fileName?: string,
) {
  const form = new FormData()
  const uploadFile =
    file instanceof File
      ? file
      : new File([file], fileName ?? `${role}-signature.png`, { type: 'image/png' })
  form.append('file', uploadFile)
  form.append('role', role)
  const response = await fetch(resolveApiUrl(`/api/insurance-claim/requests/${requestId}/signatures/upload`), {
    method: 'POST',
    headers: { ...authHeader(token) },
    body: form,
  })
  const payload = (await response.json().catch(() => ({}))) as {
    signature?: ClaimSignatureMetadata
    role?: 'insured' | 'contractor'
    message?: string
  }
  if (!response.ok || !payload.signature) {
    throw new Error(payload.message ?? '서명 업로드에 실패했습니다.')
  }
  return payload
}
