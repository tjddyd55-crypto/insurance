import { ApiError, apiRequest } from '../../../lib/apiClient'
import { normalizeSmsSettings } from '../types/sms.types'
import type {
  SmsCampaignPreview,
  SmsCampaignSummary,
  SmsOptOut,
  SmsSender,
  SmsSettings,
  SmsTemplate,
} from '../types/sms.types'

function requireSmsToken(token: string): string {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다. 다시 로그인해 주세요.', 401)
  }
  return token.trim()
}

function asArray<T>(raw: unknown): T[] {
  return Array.isArray(raw) ? raw : []
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

export async function fetchSmsSettings(token: string): Promise<SmsSettings> {
  const raw = await apiRequest<SmsSettings>('/api/sms/settings', { token: requireSmsToken(token) })
  return normalizeSmsSettings(raw)
}

export async function saveSmsSettings(
  token: string,
  input: {
    aligoUserId: string
    apiKey?: string
    defaultSender?: string
  },
): Promise<SmsSettings> {
  const raw = await apiRequest<SmsSettings>('/api/sms/settings/aligo', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      aligo_user_id: input.aligoUserId,
      api_key: input.apiKey,
      default_sender: input.defaultSender,
    }),
  })
  return normalizeSmsSettings(raw)
}

export async function deleteSmsSettings(token: string): Promise<SmsSettings> {
  const raw = await apiRequest<SmsSettings>('/api/sms/settings/aligo', {
    token: requireSmsToken(token),
    method: 'DELETE',
  })
  return normalizeSmsSettings(raw)
}

export async function fetchSmsSenders(token: string): Promise<SmsSender[]> {
  const raw = await apiRequest<SmsSender[]>('/api/sms/senders', { token: requireSmsToken(token) })
  return asArray<SmsSender>(raw)
}

export async function createSmsSender(
  token: string,
  input: {
    senderNumber: string
    label?: string
    isDefault?: boolean
  },
): Promise<SmsSender> {
  const raw = await apiRequest<SmsSender>('/api/sms/senders', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      sender_number: input.senderNumber,
      label: input.label,
      is_default: input.isDefault,
    }),
  })
  return raw as SmsSender
}

export async function testSmsSend(
  token: string,
  input: {
    senderNumber: string
    receiver: string
    message: string
  },
): Promise<{ success: boolean; errorMessage?: string; providerMessageId?: string | null }> {
  const raw = asRecord(
    await apiRequest<{ success: boolean; errorMessage?: string; providerMessageId?: string | null }>(
      '/api/sms/test-send',
      {
        token: requireSmsToken(token),
        method: 'POST',
        body: JSON.stringify({
          sender_number: input.senderNumber,
          receiver: input.receiver,
          message: input.message,
        }),
      },
    ),
  )
  return {
    success: Boolean(raw.success),
    errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage : undefined,
    providerMessageId:
      typeof raw.providerMessageId === 'string' || raw.providerMessageId === null
        ? (raw.providerMessageId as string | null)
        : undefined,
  }
}

export async function fetchSmsBalance(token: string): Promise<{
  success: boolean
  balanceText?: string
  errorMessage?: string
}> {
  const raw = asRecord(
    await apiRequest<{ success: boolean; balanceText?: string; errorMessage?: string }>('/api/sms/balance', {
      token: requireSmsToken(token),
    }),
  )
  return {
    success: Boolean(raw.success),
    balanceText: typeof raw.balanceText === 'string' ? raw.balanceText : undefined,
    errorMessage: typeof raw.errorMessage === 'string' ? raw.errorMessage : undefined,
  }
}

export async function sendSingleSms(
  token: string,
  input: {
    senderNumber: string
    receiver: string
    message: string
    customerId?: number | null
    messageType?: 'info' | 'ad'
  },
): Promise<{ success: boolean; campaignId?: number; errorMessage?: string | null }> {
  const raw = asRecord(
    await apiRequest<{ success: boolean; campaignId?: number; errorMessage?: string | null }>(
      '/api/sms/send',
      {
        token: requireSmsToken(token),
        method: 'POST',
        body: JSON.stringify({
          sender_number: input.senderNumber,
          receiver: input.receiver,
          message: input.message,
          customer_id: input.customerId,
          message_type: input.messageType,
        }),
      },
    ),
  )
  return {
    success: Boolean(raw.success),
    campaignId: typeof raw.campaignId === 'number' ? raw.campaignId : undefined,
    errorMessage:
      typeof raw.errorMessage === 'string' || raw.errorMessage === null
        ? (raw.errorMessage as string | null)
        : undefined,
  }
}

export async function previewSmsCampaign(
  token: string,
  input: {
    senderNumber: string
    message: string
    customerIds?: number[]
    filter?: { search?: string }
  },
): Promise<SmsCampaignPreview> {
  const raw = await apiRequest<SmsCampaignPreview>('/api/sms/campaigns/preview', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      sender_number: input.senderNumber,
      message: input.message,
      customer_ids: input.customerIds,
      filter: input.filter,
    }),
  })
  return raw as SmsCampaignPreview
}

export async function createSmsCampaign(
  token: string,
  input: {
    title?: string
    senderNumber: string
    message: string
    customerIds?: number[]
    scheduledAt?: string | null
    messageType?: 'info' | 'ad'
  },
): Promise<{ campaignId: number; status: string; scheduledAt: string | null }> {
  const raw = asRecord(
    await apiRequest<{ campaignId: number; status: string; scheduledAt: string | null }>(
      '/api/sms/campaigns',
      {
        token: requireSmsToken(token),
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          sender_number: input.senderNumber,
          message: input.message,
          customer_ids: input.customerIds,
          scheduled_at: input.scheduledAt,
          message_type: input.messageType,
        }),
      },
    ),
  )
  return {
    campaignId: Number(raw.campaignId ?? 0),
    status: String(raw.status ?? ''),
    scheduledAt:
      typeof raw.scheduledAt === 'string' || raw.scheduledAt === null
        ? (raw.scheduledAt as string | null)
        : null,
  }
}

export async function sendSmsCampaign(
  token: string,
  campaignId: number,
  previewConfirmed = false,
): Promise<SmsCampaignSummary> {
  const raw = await apiRequest<SmsCampaignSummary>(`/api/sms/campaigns/${campaignId}/send`, {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      preview_confirmed: previewConfirmed,
      previewConfirmed,
    }),
  })
  return raw as SmsCampaignSummary
}

export async function cancelSmsCampaign(
  token: string,
  campaignId: number,
): Promise<{ id: number; status: string }> {
  const raw = asRecord(
    await apiRequest<{ id: number; status: string }>(`/api/sms/campaigns/${campaignId}/cancel`, {
      token: requireSmsToken(token),
      method: 'POST',
    }),
  )
  return {
    id: Number(raw.id ?? campaignId),
    status: String(raw.status ?? ''),
  }
}

export async function fetchSmsCampaigns(token: string): Promise<SmsCampaignSummary[]> {
  const raw = await apiRequest<SmsCampaignSummary[]>('/api/sms/campaigns', { token: requireSmsToken(token) })
  return asArray<SmsCampaignSummary>(raw)
}

export async function fetchSmsHistory(token: string): Promise<SmsCampaignSummary[]> {
  const raw = await apiRequest<SmsCampaignSummary[]>('/api/sms/history', { token: requireSmsToken(token) })
  return asArray<SmsCampaignSummary>(raw)
}

export async function fetchSmsTemplates(token: string): Promise<SmsTemplate[]> {
  const raw = await apiRequest<SmsTemplate[]>('/api/sms/templates', { token: requireSmsToken(token) })
  return asArray<SmsTemplate>(raw)
}

export async function createSmsTemplate(
  token: string,
  input: {
    title: string
    message: string
    messageType?: 'info' | 'ad'
  },
): Promise<SmsTemplate> {
  const raw = await apiRequest<SmsTemplate>('/api/sms/templates', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      message: input.message,
      message_type: input.messageType,
    }),
  })
  return raw as SmsTemplate
}

export async function deleteSmsTemplate(token: string, id: number): Promise<void> {
  await apiRequest(`/api/sms/templates/${id}`, { token: requireSmsToken(token), method: 'DELETE' })
}

export async function fetchSmsOptOuts(token: string): Promise<SmsOptOut[]> {
  const raw = await apiRequest<SmsOptOut[]>('/api/sms/opt-outs', { token: requireSmsToken(token) })
  return asArray<SmsOptOut>(raw)
}

export async function addSmsOptOut(token: string, input: { phone: string; reason?: string }): Promise<void> {
  await apiRequest('/api/sms/opt-outs', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function removeSmsOptOut(token: string, id: number): Promise<void> {
  await apiRequest(`/api/sms/opt-outs/${id}`, { token: requireSmsToken(token), method: 'DELETE' })
}

export function estimateSmsBytes(text: string): number {
  let bytes = 0
  for (const ch of text) {
    bytes += ch.charCodeAt(0) <= 0x7f ? 1 : 2
  }
  return bytes
}

export function detectSmsType(text: string): 'SMS' | 'LMS' {
  return estimateSmsBytes(text) <= 90 ? 'SMS' : 'LMS'
}
