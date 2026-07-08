import { apiRequest } from '../../../lib/apiClient'
import type { SmsScheduleType } from '../types/smsScheduled.types'

function requireSmsToken(token: string): string {
  if (!token?.trim()) {
    throw new Error('로그인이 필요합니다.')
  }
  return token.trim()
}

export type SmsScheduledMessageDto = {
  id: number
  name: string
  description: string
  recipientGroupId: number
  messageBody: string
  messageType: 'info' | 'ad'
  scheduleType: SmsScheduleType
  sendDate: string | null
  sendTime: string
  timezone: string
  weekdays: number[]
  monthDay: number | null
  templateId: number | null
  nextRunAt: string | null
  status: 'active' | 'paused' | 'processing' | 'completed' | 'failed' | 'deleted'
  lastRunAt: string | null
  runCount: number
  lastCampaignId: number | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type CreateSmsScheduledMessageInput = {
  name: string
  description?: string
  recipientGroupId: string | number
  messageBody: string
  messageType: 'info' | 'ad'
  scheduleType: SmsScheduleType
  sendDate?: string
  sendTime: string
  timezone?: string
  weekdays?: number[]
  monthDay?: number
  templateId?: string | number
  enabled?: boolean
}

export async function fetchSmsScheduledMessages(token: string): Promise<SmsScheduledMessageDto[]> {
  const raw = await apiRequest<SmsScheduledMessageDto[]>('/api/sms/scheduled', {
    token: requireSmsToken(token),
  })
  return Array.isArray(raw) ? raw : []
}

export async function createSmsScheduledMessage(
  token: string,
  input: CreateSmsScheduledMessageInput,
): Promise<SmsScheduledMessageDto> {
  return apiRequest<SmsScheduledMessageDto>('/api/sms/scheduled', {
    token: requireSmsToken(token),
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? '',
      recipientGroupId: Number(input.recipientGroupId),
      messageBody: input.messageBody,
      messageType: input.messageType,
      scheduleType: input.scheduleType,
      sendDate: input.sendDate,
      sendTime: input.sendTime,
      timezone: input.timezone ?? 'Asia/Seoul',
      weekdays: input.weekdays,
      monthDay: input.monthDay,
      templateId: input.templateId != null && String(input.templateId).trim() ? Number(input.templateId) : null,
      enabled: input.enabled !== false,
    }),
  })
}

export async function deleteSmsScheduledMessage(token: string, id: string | number): Promise<void> {
  await apiRequest(`/api/sms/scheduled/${Number(id)}`, {
    token: requireSmsToken(token),
    method: 'DELETE',
  })
}
