export type SmsMessageType = 'info' | 'ad'
export type SmsSenderStatus = 'pending' | 'verified' | 'disabled' | 'test_passed'
export type SmsCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'canceled'

export interface SmsSettings {
  configured: boolean
  provider: 'aligo'
  aligoUserId: string
  apiKeyMasked: string | null
  defaultSender: string
  adDisplayName: string
  isActive: boolean
  lastBalanceCheckedAt: string | null
  outboundServerIpHint: string
  aligoApiSettingsUrl: string
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
  adDisplayName: '',
  isActive: false,
  lastBalanceCheckedAt: null,
  outboundServerIpHint: '',
  aligoApiSettingsUrl: 'https://smartsms.aligo.in/admin/api/auth.html',
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
    adDisplayName: row.adDisplayName ?? '',
    outboundServerIpHint: row.outboundServerIpHint ?? '',
    aligoApiSettingsUrl: row.aligoApiSettingsUrl ?? EMPTY_SMS_SETTINGS.aligoApiSettingsUrl,
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
  createdAt?: string | null
  updatedAt?: string | null
}

export interface SmsOptOut {
  id: number
  phoneMasked: string
  reason: string | null
}

export type SmsModuleTab = 'settings' | 'groups' | 'send' | 'history' | 'templates'

/** @deprecated legacy URL segments — redirect to new tabs in appRouter */
export type SmsLegacyModuleTab = 'bulk' | 'scheduled' | 'templates' | 'opt-outs'
