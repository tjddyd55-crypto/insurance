export type SmsMessageType = 'info' | 'ad'
export type SmsSenderStatus = 'pending' | 'verified' | 'disabled' | 'test_passed'
export type SmsCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'canceled'

export interface SmsSettings {
  configured: boolean
  provider: 'aligo'
  aligoUserId: string
  apiKeyMasked: string | null
  defaultSender: string
  isActive: boolean
  lastBalanceCheckedAt: string | null
  outboundServerIpHint: string
  aligoChargeUrl: string
  aligoSenderRegisterUrl: string
  moduleEnabled: boolean
  realSendEnabled: boolean
  providerMode: 'mock' | 'aligo' | 'gateway' | 'invalid'
  providerIsMock: boolean
  usesGateway?: boolean
  providerMisconfigured?: boolean
  aligoTestMode: boolean
}

export const EMPTY_SMS_SETTINGS: SmsSettings = {
  configured: false,
  provider: 'aligo',
  aligoUserId: '',
  apiKeyMasked: null,
  defaultSender: '',
  isActive: false,
  lastBalanceCheckedAt: null,
  outboundServerIpHint: '',
  aligoChargeUrl: 'https://smartsms.aligo.in/shop/charge.html',
  aligoSenderRegisterUrl: 'https://smartsms.aligo.in/admin/sender/list.html',
  moduleEnabled: true,
  realSendEnabled: false,
  providerMode: 'mock',
  providerIsMock: true,
  aligoTestMode: false,
}

export function normalizeSmsSettings(raw: unknown): SmsSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_SMS_SETTINGS }
  }
  const row = raw as Partial<SmsSettings>
  return {
    ...EMPTY_SMS_SETTINGS,
    ...row,
    aligoUserId: row.aligoUserId ?? '',
    apiKeyMasked: row.apiKeyMasked ?? null,
    defaultSender: row.defaultSender ?? '',
    outboundServerIpHint: row.outboundServerIpHint ?? '',
    aligoChargeUrl: row.aligoChargeUrl ?? EMPTY_SMS_SETTINGS.aligoChargeUrl,
    aligoSenderRegisterUrl: row.aligoSenderRegisterUrl ?? EMPTY_SMS_SETTINGS.aligoSenderRegisterUrl,
  }
}

export interface SmsSender {
  id: number
  senderNumber: string
  label: string
  status: SmsSenderStatus
  isDefault: boolean
  lastTestSentAt: string | null
}

export interface SmsCampaignPreview {
  senderNumber: string
  messageTypeDetected: 'SMS' | 'LMS'
  sendableCount: number
  skippedCount: number
  skipReasonCounts: Record<string, number>
  samples: Array<{
    customerId: number
    customerName: string
    phone: string
    sampleMessage: string
  }>
}

export interface SmsCampaignSummary {
  id: number
  title: string
  message: string
  messageType: SmsMessageType
  senderNumber: string
  targetCount: number
  successCount: number
  failCount: number
  skippedCount: number
  status: SmsCampaignStatus
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
}

export interface SmsTemplate {
  id: number
  title: string
  message: string
  messageType: SmsMessageType
}

export interface SmsOptOut {
  id: number
  phoneMasked: string
  reason: string | null
}

export type SmsModuleTab =
  | 'settings'
  | 'send'
  | 'bulk'
  | 'scheduled'
  | 'templates'
  | 'history'
  | 'opt-outs'
