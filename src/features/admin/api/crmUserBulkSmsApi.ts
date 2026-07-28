import { apiRequest } from '../../../lib/apiClient'

export type CrmUserBulkSmsRuntime = {
  enabled: boolean
  realSendEnabled: boolean
  maxRecipients: number
  defaultSender: string | null
  productionRuntime: boolean
  allowlistCount: number
  audienceType: 'CRM_USER'
  sourceType: 'SUPER_ADMIN_BULK_NOTICE'
}

export type CrmUserBulkSmsPreviewRecipient = {
  userId: string
  displayName: string
  username: string
  gaCompanyName: string
  role: string
  phoneMasked: string
  status: string
  exclusionReason: string | null
}

export type CrmUserBulkSmsPreview = {
  runtime: CrmUserBulkSmsRuntime
  title: string
  message: string
  senderNumber: string | null
  audienceType: string
  sourceType: string
  messagePurpose: string
  summary: {
    targetCount: number
    eligibleCount: number
    excludedCount: number
    uniquePhoneCount: number
    smsType: 'SMS' | 'LMS'
    exclusionBreakdown: Record<string, number>
  }
  recipients: CrmUserBulkSmsPreviewRecipient[]
}

export type CrmUserBulkSmsCampaign = {
  id: number
  title: string
  status: string
  dryRun: boolean
  smsType: string
  targetCount: number
  eligibleCount: number
  successCount: number
  failedCount: number
  excludedCount: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  requestedBy: string | null
  senderNumber: string | null
  requestedByUsername?: string | null
  requestedByDisplayName?: string | null
  messageTemplate?: string
}

async function unwrapData<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<{ success?: boolean; data?: T; message?: string }>(path, {
    ...init,
    token,
  })
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data
  }
  return res as T
}

export async function fetchCrmUserBulkSmsRuntime(token: string) {
  return unwrapData<CrmUserBulkSmsRuntime>(token, '/api/admin/users/bulk-sms/runtime')
}

export async function previewCrmUserBulkSms(
  token: string,
  body: { userIds: string[]; message: string; title?: string; senderNumber?: string },
) {
  return unwrapData<CrmUserBulkSmsPreview>(token, '/api/admin/users/bulk-sms/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function sendCrmUserBulkSms(
  token: string,
  body: {
    userIds: string[]
    message: string
    title?: string
    senderNumber?: string
    idempotencyKey: string
    confirm: true
  },
) {
  return unwrapData<{ campaign: CrmUserBulkSmsCampaign; reused: boolean; dryRun?: boolean }>(
    token,
    '/api/admin/users/bulk-sms/send',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

export async function listCrmUserBulkSmsHistory(token: string) {
  return unwrapData<CrmUserBulkSmsCampaign[]>(token, '/api/admin/users/bulk-sms/history')
}

export async function getCrmUserBulkSmsHistoryDetail(token: string, id: number) {
  return unwrapData<{
    campaign: CrmUserBulkSmsCampaign
    recipients: Array<{
      userId: string
      displayName: string
      username: string
      gaCompanyName: string
      role: string
      phoneMasked: string
      status: string
      exclusionReason: string | null
      errorCode: string | null
      sentAt: string | null
    }>
  }>(token, `/api/admin/users/bulk-sms/history/${id}`)
}
