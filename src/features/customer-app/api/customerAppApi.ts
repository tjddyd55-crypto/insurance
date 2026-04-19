import { ApiError, apiRequest, resolveApiUrl } from '../../../lib/apiClient'
import {
  readCustomerAppProfile,
  readCustomerAppSession,
  resolveCustomerDeviceId,
  writeCustomerAppSession,
} from '../session/customerAppSession'

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

export interface CustomerAppProfile {
  name: string
  birthDate: string
  phone: string
  savedAt: string | null
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
  heroImageUrl?: string | null
  scope?: 'all' | 'personal'
  targetCustomerId?: number | null
}

export interface CustomerAppNewsDetail {
  id: string
  title: string
  content: string
  updatedAt: string | null
  isPinned: boolean
  heroImageUrl?: string | null
  attachments?: Array<{
    id: string
    kind: 'image' | 'file'
    url: string
    fileName: string
    sortOrder: number
    objectKey?: string
    mimeType?: string
    size?: number
  }>
}

let reconnectTask: Promise<string | null> | null = null

async function connectCustomerAppInternal(payload: {
  linkCode: string
  deviceId: string
  devicePlatform: string
  appVersion: string
  requester: {
    name: string
    birthDate: string
    phone: string
  }
}): Promise<CustomerAppConnectResponse> {
  const response = await apiRequest<{ success: true; data: CustomerAppConnectResponse }>('/api/customer-app/connect', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return response as CustomerAppConnectResponse
}

async function reconnectCustomerSession(): Promise<string | null> {
  if (reconnectTask) {
    return reconnectTask
  }
  reconnectTask = (async () => {
    const session = readCustomerAppSession()
    const profile = readCustomerAppProfile()
    const linkCode = String(session?.linkCode ?? '').trim().toUpperCase()
    if (!session || !profile || !linkCode) {
      return null
    }
    const deviceId = resolveCustomerDeviceId()
    const connected = await connectCustomerAppInternal({
      linkCode,
      deviceId,
      devicePlatform: /android/i.test(navigator.userAgent)
        ? 'android'
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? 'ios'
          : 'web',
      appVersion: 'web-1.0.0',
      requester: {
        name: profile.name,
        birthDate: profile.birthDate,
        phone: profile.phone,
      },
    })
    writeCustomerAppSession({
      ...session,
      appToken: connected.appToken,
      agentId: connected.agentId,
      customerId: connected.customerId,
      deviceId,
      agentName: connected.agentName,
      customerName: connected.customerName,
      linkCode,
      requesterName: profile.name,
      requesterBirthDate: profile.birthDate,
      requesterPhone: profile.phone,
    })
    return connected.appToken
  })()
  try {
    return await reconnectTask
  } finally {
    reconnectTask = null
  }
}

async function customerAppApiRequest<T>(
  path: string,
  appToken: string,
  options: Omit<RequestInit, 'headers'> & { headers?: HeadersInit } = {},
): Promise<T> {
  try {
    return await apiRequest<T>(path, {
      ...options,
      token: appToken,
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const renewed = await reconnectCustomerSession()
      if (renewed) {
        return await apiRequest<T>(path, {
          ...options,
          token: renewed,
        })
      }
    }
    throw error
  }
}

export async function connectCustomerApp(payload: {
  linkCode: string
  deviceId: string
  devicePlatform: string
  appVersion: string
  requester: {
    name: string
    birthDate: string
    phone: string
  }
}): Promise<CustomerAppConnectResponse> {
  return connectCustomerAppInternal(payload)
}

export async function getCustomerAppMe(appToken: string): Promise<CustomerAppMe> {
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppMe }>(
    '/api/customer-app/me',
    appToken,
  )
  return response as CustomerAppMe
}

export async function getCustomerAppProfile(appToken: string): Promise<CustomerAppProfile | null> {
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppProfile | null }>(
    '/api/customer-app/profile',
    appToken,
  )
  return response as CustomerAppProfile | null
}

export async function saveCustomerAppProfile(
  appToken: string,
  payload: { name: string; birthDate: string; phone: string },
): Promise<CustomerAppProfile> {
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppProfile }>(
    '/api/customer-app/profile',
    appToken,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
  return response as CustomerAppProfile
}

export async function requestClaimFilePresign(
  appToken: string,
  payload: { fileName: string; contentType: string; fileSize: number },
): Promise<CustomerAppClaimFilePresign> {
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppClaimFilePresign }>(
    '/api/customer-app/claim-files/presign',
    appToken,
    {
      method: 'POST',
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
    requester?: {
      name: string
      birthDate: string
      phone: string
    }
    files: Array<{
      storageKey: string
      fileName: string
      contentType?: string
      fileSize?: number
    }>
  },
): Promise<{ requestId: number; status: string; submittedAt: string | null; fileCount: number }> {
  const response = await customerAppApiRequest<{
    success: true
    data: { requestId: number; status: string; submittedAt: string | null; fileCount: number }
  }>('/api/customer-app/claim-requests', appToken, {
    method: 'POST',
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
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppClaimRequestListItem[] }>(
    '/api/customer-app/claim-requests',
    appToken,
  )
  return response as CustomerAppClaimRequestListItem[]
}

export async function getCustomerClaimRequestDetail(
  appToken: string,
  requestId: number,
): Promise<CustomerAppClaimRequestDetail> {
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppClaimRequestDetail }>(
    `/api/customer-app/claim-requests/${requestId}`,
    appToken,
  )
  return response as CustomerAppClaimRequestDetail
}

export async function listCustomerNewsByScope(
  appToken: string,
  scope: 'all' | 'personal',
): Promise<CustomerAppNewsListItem[]> {
  const search = new URLSearchParams({ scope })
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppNewsListItem[] }>(
    `/api/customer-app/news?${search.toString()}`,
    appToken,
  )
  return response as CustomerAppNewsListItem[]
}

export async function listCustomerNews(appToken: string): Promise<CustomerAppNewsListItem[]> {
  return listCustomerNewsByScope(appToken, 'all')
}

export async function getCustomerNewsDetail(appToken: string, newsId: string): Promise<CustomerAppNewsDetail> {
  const response = await customerAppApiRequest<{ success: true; data: CustomerAppNewsDetail }>(
    `/api/customer-app/news/${newsId}`,
    appToken,
  )
  return response as CustomerAppNewsDetail
}

export async function markCustomerNewsRead(appToken: string, newsId: string): Promise<void> {
  await customerAppApiRequest<void>(`/api/customer-app/news/${newsId}/read`, appToken, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
