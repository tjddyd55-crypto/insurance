import { ApiError, apiRequest } from '../../../lib/apiClient'
import type { CustomerRecord } from '../domain/types'

export type CustomerConsultationRow = {
  id: number
  customerId: number
  userId: string
  gaId: number
  body: string
  createdAt: string
}

export type CustomerRelationRow = {
  relatedCustomerId: number
  relatedName: string
  relatedPhone: string
  createdAt: string
}

export type ConsultationCountsResponse = {
  counts: Record<string, number>
}

export type CustomerFileRow = {
  id: number
  customerId: number
  content: string
  fileName: string
  objectKey: string | null
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
  expiresAt: string | null
  deletedAt: string | null
}

export type SaveCustomerFilePayload = {
  content: string
  fileName: string
  objectKey: string
  fileUrl: string
  size: number
  mimeType?: string | null
}

export type CustomerFilePresignResponse = {
  uploadUrl: string
  fileUrl: string
  objectKey: string
  putHeaders?: Record<string, string>
}

export async function fetchConsultationCounts(token: string): Promise<ConsultationCountsResponse> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<ConsultationCountsResponse>('/api/customers/consultations/counts', { token })
}

export async function listCustomerConsultations(
  token: string,
  customerId: number,
  opts?: { limit?: number; offset?: number },
): Promise<CustomerConsultationRow[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const q = new URLSearchParams()
  if (opts?.limit != null) {
    q.set('limit', String(opts.limit))
  }
  if (opts?.offset != null) {
    q.set('offset', String(opts.offset))
  }
  const suffix = q.toString() ? `?${q.toString()}` : ''
  return apiRequest<CustomerConsultationRow[]>(`/api/customers/${customerId}/consultations${suffix}`, {
    token,
  })
}

export async function createCustomerConsultation(
  token: string,
  customerId: number,
  body: string,
  opts?: { consultationDate?: string },
): Promise<CustomerConsultationRow> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const payload: { body: string; consultationDate?: string } = { body }
  const d = opts?.consultationDate?.trim()
  if (d) {
    payload.consultationDate = d
  }
  return apiRequest<CustomerConsultationRow>(`/api/customers/${customerId}/consultations`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deleteCustomerConsultation(
  token: string,
  customerId: number,
  consultId: number,
): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean }>(`/api/customers/${customerId}/consultations/${consultId}`, {
    method: 'DELETE',
    token,
  })
}

export async function listCustomerRelations(
  token: string,
  customerId: number,
): Promise<CustomerRelationRow[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<CustomerRelationRow[]>(`/api/customers/${customerId}/relations`, { token })
}

export async function createCustomerRelation(
  token: string,
  customerId: number,
  relatedCustomerId: number,
): Promise<{ ok: boolean; customerId: number; relatedCustomerId: number }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean; customerId: number; relatedCustomerId: number }>(
    `/api/customers/${customerId}/relations`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ relatedCustomerId }),
    },
  )
}

export async function deleteCustomerRelation(
  token: string,
  customerId: number,
  relatedCustomerId: number,
): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean }>(`/api/customers/${customerId}/relations/${relatedCustomerId}`, {
    method: 'DELETE',
    token,
  })
}

export async function searchCustomersAdvanced(
  token: string,
  opts: { q: string; includeRelations?: boolean; limit?: number },
): Promise<CustomerRecord[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const q = new URLSearchParams()
  q.set('q', opts.q)
  if (opts.includeRelations) {
    q.set('includeRelations', '1')
  }
  if (opts.limit != null) {
    q.set('limit', String(opts.limit))
  }
  return apiRequest<CustomerRecord[]>(`/api/customers/search/advanced?${q.toString()}`, { token })
}

export async function presignCustomerFile(
  token: string,
  customerId: number,
  body: { fileName: string; contentType: string; sizeBytes: number },
): Promise<CustomerFilePresignResponse> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<CustomerFilePresignResponse>(`/api/customers/${customerId}/files/presign`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      fileName: body.fileName,
      contentType: body.contentType,
      size: body.sizeBytes,
    }),
  })
}

export async function saveCustomerFile(
  token: string,
  customerId: number,
  body: SaveCustomerFilePayload,
): Promise<CustomerFileRow> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  const payload: Record<string, unknown> = {
    content: body.content,
    fileName: body.fileName,
    objectKey: body.objectKey,
    fileUrl: body.fileUrl,
    size: body.size,
  }
  const mt = body.mimeType?.trim()
  if (mt) {
    payload.mimeType = mt
  }
  return apiRequest<CustomerFileRow>(`/api/customers/${customerId}/files`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function listCustomerFiles(token: string, customerId: number): Promise<CustomerFileRow[]> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<CustomerFileRow[]>(`/api/customers/${customerId}/files`, { token })
}

export async function deleteCustomerFile(token: string, fileId: number): Promise<{ ok: boolean }> {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
  return apiRequest<{ ok: boolean }>(`/api/customers/files/${fileId}`, {
    method: 'DELETE',
    token,
  })
}
