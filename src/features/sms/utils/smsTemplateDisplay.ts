import type { SmsTemplate } from '../types/sms.types'
import { detectSmsType, estimateSmsBytes } from '../api/smsApi'

export function formatSmsTemplateTransportLabel(message: string): 'SMS' | 'LMS' {
  return detectSmsType(message)
}

export function formatSmsTemplateByteLabel(message: string): string {
  return `${estimateSmsBytes(message)}byte`
}

export function formatSmsTemplateMetaLine(template: SmsTemplate): string {
  const transport = formatSmsTemplateTransportLabel(template.message)
  const bytes = estimateSmsBytes(template.message)
  return `${transport} · ${bytes}byte`
}

export function formatSmsTemplateDateLabel(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('ko-KR', { hour12: false })
}

export function formatSmsTemplateMessageTypeLabel(messageType: SmsTemplate['messageType']): string {
  return messageType === 'ad' ? '광고' : '일반'
}
