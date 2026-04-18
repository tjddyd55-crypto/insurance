import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'

export interface CustomerAppConnectResponse {
  agentId: string
  customerId: number
  agentName: string
  customerName: string
  appToken: string
}

export interface CustomerAppMe {
  agentId: string
  customerId: number
  deviceId: string
  agentName: string
  customerName: string
  status: string
  lastConnectedAt: string | null
}

export interface CustomerAppClaimFilePresign {
  storageKey: string
  uploadUrl: string | null
  uploadMethod?: 'direct' | 'proxy'
  uploadProxyPath?: string
  publicUrl: string | null
  putHeaders?: Record<string, string>
}

export interface CustomerAppClaimRequestListItem {
  id: number
  status: string
  title: string
  memo: string
  submittedAt: string | null
  fileCount: number
}

export interface CustomerAppClaimRequestDetailFile {
  id: number
  storageKey: string
  fileName: string
  contentType: string
  fileSize: number
  sortOrder: number
  uploadedAt: string | null
  url: string
  downloadUrl?: string
}

export interface CustomerAppClaimRequestDetail {
  id: number
  status: string
  title: string
  memo: string
  submittedAt: string | null
  processedAt: string | null
  files: CustomerAppClaimRequestDetailFile[]
  statusLogs: Array<{
    id: number
    fromStatus: string | null
    toStatus: string
    changedAt: string | null
    memo: string
  }>
}

export interface CustomerAppNewsListItem {
  id: string
  title: string
  summary: string
  updatedAt: string | null
  isRead: boolean
  isPinned: boolean
}

export interface CustomerAppNewsDetail {
  id: string
  title: string
  content: string
  updatedAt: string | null
  isPinned: boolean
}

export async function connectCustomerApp(payload: {
  linkCode: string
  deviceId: string
  devicePlatform: string
  appVersion: string
}): Promise<CustomerAppConnectResponse> {
  const response = await apiRequest<{ success: true; data: CustomerAppConnectResponse }>('/api/customer-app/connect', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return response as CustomerAppConnectResponse
}

export async function getCustomerAppMe(appToken: string): Promise<CustomerAppMe> {
  const response = await apiRequest<{ success: true; data: CustomerAppMe }>('/api/customer-app/me', {
    token: appToken,
  })
  return response as CustomerAppMe
}

export async function requestClaimFilePresign(
  appToken: string,
  payload: { fileName: string; contentType: string; fileSize: number },
): Promise<CustomerAppClaimFilePresign> {
  const response = await apiRequest<{ success: true; data: CustomerAppClaimFilePresign }>(
    '/api/customer-app/claim-files/presign',
    {
      method: 'POST',
      token: appToken,
      body: JSON.stringify(payload),
    },
  )
  return response as CustomerAppClaimFilePresign
}

export async function createCustomerClaimRequest(
  appToken: string,
  payload: {
    title?: string
    memo?: string
    files: Array<{
      storageKey: string
      fileName: string
      contentType?: string
      fileSize?: number
    }>
  },
): Promise<{ requestId: number; status: string; submittedAt: string | null; fileCount: number }> {
  const response = await apiRequest<{
    success: true
    data: { requestId: number; status: string; submittedAt: string | null; fileCount: number }
  }>('/api/customer-app/claim-requests', {
    method: 'POST',
    token: appToken,
    body: JSON.stringify(payload),
  })
  return response as { requestId: number; status: string; submittedAt: string | null; fileCount: number }
}

export async function uploadCustomerClaimFileProxy(
  appToken: string,
  payload: {
    storageKey: string
    contentType: string
    fileSize: number
    file: File
  },
): Promise<void> {
  const query = new URLSearchParams({
    storageKey: payload.storageKey,
    contentType: payload.contentType,
    fileSize: String(payload.fileSize),
  })
  const response = await fetch(resolveApiUrl(`/api/customer-app/claim-files/upload-proxy?${query.toString()}`), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${appToken}`,
      'Content-Type': payload.contentType || 'application/octet-stream',
      'X-File-Size': String(payload.fileSize),
    },
    body: payload.file,
  })
  if (!response.ok) {
    const payloadBody = (await response.json().catch(() => ({}))) as { message?: string; error?: string }
    throw new Error(payloadBody.message ?? payloadBody.error ?? `파일 업로드 실패 (${response.status})`)
  }
}

export async function listCustomerClaimRequests(appToken: string): Promise<CustomerAppClaimRequestListItem[]> {
  const response = await apiRequest<{ success: true; data: CustomerAppClaimRequestListItem[] }>(
    '/api/customer-app/claim-requests',
    { token: appToken },
  )
  return response as CustomerAppClaimRequestListItem[]
}

export async function getCustomerClaimRequestDetail(
  appToken: string,
  requestId: number,
): Promise<CustomerAppClaimRequestDetail> {
  const response = await apiRequest<{ success: true; data: CustomerAppClaimRequestDetail }>(
    `/api/customer-app/claim-requests/${requestId}`,
    { token: appToken },
  )
  return response as CustomerAppClaimRequestDetail
}

export async function listCustomerNews(appToken: string): Promise<CustomerAppNewsListItem[]> {
  const response = await apiRequest<{ success: true; data: CustomerAppNewsListItem[] }>('/api/customer-app/news', {
    token: appToken,
  })
  return response as CustomerAppNewsListItem[]
}

export async function getCustomerNewsDetail(appToken: string, newsId: string): Promise<CustomerAppNewsDetail> {
  const response = await apiRequest<{ success: true; data: CustomerAppNewsDetail }>(`/api/customer-app/news/${newsId}`, {
    token: appToken,
  })
  return response as CustomerAppNewsDetail
}

export async function markCustomerNewsRead(appToken: string, newsId: string): Promise<void> {
  await apiRequest<void>(`/api/customer-app/news/${newsId}/read`, {
    method: 'POST',
    token: appToken,
    body: JSON.stringify({}),
  })
}
