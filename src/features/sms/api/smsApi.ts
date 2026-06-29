import { apiRequest } from '../../../lib/apiClient'
import type {
  SmsCampaignPreview,
  SmsCampaignSummary,
  SmsOptOut,
  SmsSender,
  SmsSettings,
  SmsTemplate,
} from '../types/sms.types'

type ApiEnvelope<T> = { success: boolean; data: T; message?: string }

export async function fetchSmsSettings(): Promise<SmsSettings> {
  const res = await apiRequest<ApiEnvelope<SmsSettings>>('/sms/settings')
  return res.data
}

export async function saveSmsSettings(input: {
  aligoUserId: string
  apiKey?: string
  defaultSender?: string
}): Promise<SmsSettings> {
  const res = await apiRequest<ApiEnvelope<SmsSettings>>('/sms/settings/aligo', {
    method: 'POST',
    body: JSON.stringify({
      aligo_user_id: input.aligoUserId,
      api_key: input.apiKey,
      default_sender: input.defaultSender,
    }),
  })
  return res.data
}

export async function deleteSmsSettings(): Promise<SmsSettings> {
  const res = await apiRequest<ApiEnvelope<SmsSettings>>('/sms/settings/aligo', { method: 'DELETE' })
  return res.data
}

export async function fetchSmsSenders(): Promise<SmsSender[]> {
  const res = await apiRequest<ApiEnvelope<SmsSender[]>>('/sms/senders')
  return res.data
}

export async function createSmsSender(input: {
  senderNumber: string
  label?: string
  isDefault?: boolean
}): Promise<SmsSender> {
  const res = await apiRequest<ApiEnvelope<SmsSender>>('/sms/senders', {
    method: 'POST',
    body: JSON.stringify({
      sender_number: input.senderNumber,
      label: input.label,
      is_default: input.isDefault,
    }),
  })
  return res.data
}

export async function testSmsSend(input: {
  senderNumber: string
  receiver: string
  message: string
}): Promise<{ success: boolean; errorMessage?: string; providerMessageId?: string | null }> {
  const res = await apiRequest<{
    success: boolean
    data: { success: boolean; errorMessage?: string; providerMessageId?: string | null }
  }>('/sms/test-send', {
    method: 'POST',
    body: JSON.stringify({
      sender_number: input.senderNumber,
      receiver: input.receiver,
      message: input.message,
    }),
  })
  return res.data
}

export async function fetchSmsBalance(): Promise<{
  success: boolean
  balanceText?: string
  errorMessage?: string
}> {
  const res = await apiRequest<{
    success: boolean
    data: { success: boolean; balanceText?: string; errorMessage?: string }
  }>('/sms/balance')
  return res.data
}

export async function sendSingleSms(input: {
  senderNumber: string
  receiver: string
  message: string
  customerId?: number | null
  messageType?: 'info' | 'ad'
}): Promise<{ success: boolean; campaignId?: number; errorMessage?: string | null }> {
  const res = await apiRequest<{
    success: boolean
    data: { success: boolean; campaignId?: number; errorMessage?: string | null }
  }>('/sms/send', {
    method: 'POST',
    body: JSON.stringify({
      sender_number: input.senderNumber,
      receiver: input.receiver,
      message: input.message,
      customer_id: input.customerId,
      message_type: input.messageType,
    }),
  })
  return res.data
}

export async function previewSmsCampaign(input: {
  senderNumber: string
  message: string
  customerIds?: number[]
  filter?: { search?: string }
}): Promise<SmsCampaignPreview> {
  const res = await apiRequest<ApiEnvelope<SmsCampaignPreview>>('/sms/campaigns/preview', {
    method: 'POST',
    body: JSON.stringify({
      sender_number: input.senderNumber,
      message: input.message,
      customer_ids: input.customerIds,
      filter: input.filter,
    }),
  })
  return res.data
}

export async function createSmsCampaign(input: {
  title?: string
  senderNumber: string
  message: string
  customerIds?: number[]
  scheduledAt?: string | null
  messageType?: 'info' | 'ad'
}): Promise<{ campaignId: number; status: string; scheduledAt: string | null }> {
  const res = await apiRequest<
    ApiEnvelope<{ campaignId: number; status: string; scheduledAt: string | null }>
  >('/sms/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      sender_number: input.senderNumber,
      message: input.message,
      customer_ids: input.customerIds,
      scheduled_at: input.scheduledAt,
      message_type: input.messageType,
    }),
  })
  return res.data
}

export async function sendSmsCampaign(campaignId: number, previewConfirmed = false): Promise<SmsCampaignSummary> {
  const res = await apiRequest<ApiEnvelope<SmsCampaignSummary>>(`/sms/campaigns/${campaignId}/send`, {
    method: 'POST',
    body: JSON.stringify({
      preview_confirmed: previewConfirmed,
      previewConfirmed,
    }),
  })
  return res.data
}

export async function cancelSmsCampaign(campaignId: number): Promise<{ id: number; status: string }> {
  const res = await apiRequest<ApiEnvelope<{ id: number; status: string }>>(
    `/sms/campaigns/${campaignId}/cancel`,
    { method: 'POST' },
  )
  return res.data
}

export async function fetchSmsCampaigns(): Promise<SmsCampaignSummary[]> {
  const res = await apiRequest<ApiEnvelope<SmsCampaignSummary[]>>('/sms/campaigns')
  return res.data
}

export async function fetchSmsHistory(): Promise<SmsCampaignSummary[]> {
  const res = await apiRequest<ApiEnvelope<SmsCampaignSummary[]>>('/sms/history')
  return res.data
}

export async function fetchSmsTemplates(): Promise<SmsTemplate[]> {
  const res = await apiRequest<ApiEnvelope<SmsTemplate[]>>('/sms/templates')
  return res.data
}

export async function createSmsTemplate(input: {
  title: string
  message: string
  messageType?: 'info' | 'ad'
}): Promise<SmsTemplate> {
  const res = await apiRequest<ApiEnvelope<SmsTemplate>>('/sms/templates', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      message: input.message,
      message_type: input.messageType,
    }),
  })
  return res.data
}

export async function deleteSmsTemplate(id: number): Promise<void> {
  await apiRequest(`/sms/templates/${id}`, { method: 'DELETE' })
}

export async function fetchSmsOptOuts(): Promise<SmsOptOut[]> {
  const res = await apiRequest<ApiEnvelope<SmsOptOut[]>>('/sms/opt-outs')
  return res.data
}

export async function addSmsOptOut(input: { phone: string; reason?: string }): Promise<void> {
  await apiRequest('/sms/opt-outs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function removeSmsOptOut(id: number): Promise<void> {
  await apiRequest(`/sms/opt-outs/${id}`, { method: 'DELETE' })
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
