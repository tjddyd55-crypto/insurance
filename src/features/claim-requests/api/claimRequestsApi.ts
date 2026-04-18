import { apiRequest } from '../../../lib/apiClient'

export type ClaimRequestStatus = 'requested' | 'processing' | 'done' | 'rejected' | 'canceled'

export interface ClaimRequestListItem {
  id: number
  customerId: number
  deviceId: string
  customerName: string
  status: ClaimRequestStatus
  title: string
  memo: string
  submittedAt: string | null
  fileCount: number
}

export interface ClaimRequestFileItem {
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

export interface ClaimRequestStatusLogItem {
  id: number
  fromStatus: ClaimRequestStatus | null
  toStatus: ClaimRequestStatus
  changedByUserId: string | null
  changedAt: string | null
  memo: string
}

export interface ClaimRequestDetail {
  id: number
  agentId: string
  customerId: number
  customerName: string
  deviceId: string
  status: ClaimRequestStatus
  title: string
  memo: string
  requestType: string
  submittedAt: string | null
  processedAt: string | null
  files: ClaimRequestFileItem[]
  statusLogs: ClaimRequestStatusLogItem[]
}

export interface CustomerAppLinkInfo {
  linkId: number
  linkCode: string
  agentCode?: string
  connectUrl: string
  universalUrl: string
  customerId?: number
  customerCode?: string
  status: string
  createdAt?: string | null
  expiresAt?: string | null
  lastConnectedAt?: string | null
  deviceCount: number
}

export async function createCustomerAppLink(token: string): Promise<CustomerAppLinkInfo> {
  const response = await apiRequest<{ success: true; data: CustomerAppLinkInfo }>('/api/agent/customer-app-links', {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  })
  return response as CustomerAppLinkInfo
}

export async function getCustomerAppLink(token: string, customerId: number): Promise<CustomerAppLinkInfo | null> {
  const response = await apiRequest<{ success: true; data: CustomerAppLinkInfo | null }>(
    `/api/agent/customers/${customerId}/customer-app-link`,
    { token },
  )
  return response as CustomerAppLinkInfo | null
}

export async function listClaimRequests(
  token: string,
  params: { status?: ClaimRequestStatus | ''; customerId?: number | null; page?: number; pageSize?: number } = {},
): Promise<{ rows: ClaimRequestListItem[]; total: number; page: number; pageSize: number }> {
  const search = new URLSearchParams()
  if (params.status) {
    search.set('status', params.status)
  }
  if (params.customerId && Number.isInteger(params.customerId) && params.customerId > 0) {
    search.set('customerId', String(params.customerId))
  }
  if (params.page && params.page > 0) {
    search.set('page', String(params.page))
  }
  if (params.pageSize && params.pageSize > 0) {
    search.set('pageSize', String(params.pageSize))
  }
  const query = search.toString()
  const response = await apiRequest<{
    success: true
    data: { rows: ClaimRequestListItem[]; total: number; page: number; pageSize: number }
  }>(`/api/agent/customer-claim-requests${query ? `?${query}` : ''}`, { token })
  return response as { rows: ClaimRequestListItem[]; total: number; page: number; pageSize: number }
}

export async function getClaimRequestDetail(token: string, requestId: number): Promise<ClaimRequestDetail> {
  const response = await apiRequest<{ success: true; data: ClaimRequestDetail }>(
    `/api/agent/customer-claim-requests/${requestId}`,
    { token },
  )
  return response as ClaimRequestDetail
}

export async function updateClaimRequestStatus(
  token: string,
  requestId: number,
  payload: { status: ClaimRequestStatus; memo?: string },
): Promise<{ requestId: number; status: ClaimRequestStatus; fromStatus: ClaimRequestStatus; memo: string }> {
  const response = await apiRequest<{
    success: true
    data: { requestId: number; status: ClaimRequestStatus; fromStatus: ClaimRequestStatus; memo: string }
  }>(`/api/agent/customer-claim-requests/${requestId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
  return response as { requestId: number; status: ClaimRequestStatus; fromStatus: ClaimRequestStatus; memo: string }
}

export async function createCustomerNews(
  token: string,
  payload: { title: string; content: string; sendPush?: boolean; isPinned?: boolean },
): Promise<{ id: string }> {
  const response = await apiRequest<{ success: true; data: { id: string } }>('/api/agent/customer-news', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
  return response as { id: string }
}
