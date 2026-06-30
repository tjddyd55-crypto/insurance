import {
  SMS_AD_OPT_OUT_NUMBER,
  SMS_BYTE_LIMIT,
  SMS_DEDUCTION_LABELS,
  SMS_SAMPLE_COMPANY_NAME,
  SMS_TRANSPORT_TYPE_LABELS,
} from '../config/smsCompose.config'
import {
  applySmsTemplateVariables,
  type SmsTemplateVariableKey,
} from './smsTemplateVariables'

export type SmsTransportType = 'SMS' | 'LMS' | 'MMS'

export type SmsPreviewAttachment = {
  previewUrl: string
  fileName: string
} | null

export type SmsMessageMetaInput = {
  body: string
  isAdvertisement?: boolean
  attachments?: SmsPreviewAttachment[]
  sampleVariables?: Partial<Record<SmsTemplateVariableKey, string>>
  adCompanyName?: string
  optOutNumber?: string | null
}

/** @deprecated 호환 alias */
export type SmsMessageMetaOptions = {
  messageType?: 'info' | 'ad'
  attachments?: SmsPreviewAttachment[]
  sampleVars?: Partial<Record<SmsTemplateVariableKey, string>>
  senderDisplay?: string
  adSenderLabel?: string
}

export type SmsMessageMeta = {
  rawText: string
  previewText: string
  renderedText: string
  previewBody: string
  previewHeader: string | null
  previewFooter: string | null
  charCount: number
  byteCount: number
  messageType: SmsTransportType
  typeLabel: string
  deductionLabel: string
  reason: string | null
  limitByte: number
  isOverSmsLimit: boolean
  hasAttachment: boolean
  hasVariables: boolean
  hasOptOut: boolean
  usesSampleSubstitution: boolean
  transitionReason: string | null
}

export function estimateSmsByteLength(text: string): number {
  let bytes = 0
  for (const ch of text) {
    bytes += ch.charCodeAt(0) <= 0x7f ? 1 : 2
  }
  return bytes
}

function resolveTransportType(byteCount: number, hasAttachment: boolean): SmsTransportType {
  if (hasAttachment) {
    return 'MMS'
  }
  return byteCount <= SMS_BYTE_LIMIT ? 'SMS' : 'LMS'
}

function buildTransitionReason(
  previous: SmsTransportType | null,
  next: SmsTransportType,
  hasAttachment: boolean,
): string | null {
  if (previous == null || previous === next) {
    return null
  }
  if (next === 'MMS' && hasAttachment) {
    return '이미지가 첨부되어 그림(MMS)으로 전환되었습니다.'
  }
  if (previous === 'SMS' && next === 'LMS') {
    return `${SMS_BYTE_LIMIT}byte를 초과하여 장문(LMS)으로 전환되었습니다.`
  }
  if (previous === 'LMS' && next === 'SMS') {
    return `${SMS_BYTE_LIMIT}byte 이하로 단문(SMS)으로 변경되었습니다.`
  }
  if (previous === 'MMS' && next !== 'MMS') {
    return '이미지가 제거되어 텍스트 길이 기준으로 발송 유형이 변경되었습니다.'
  }
  return null
}

function normalizeInput(input: SmsMessageMetaInput | string, legacyOptions?: SmsMessageMetaOptions): SmsMessageMetaInput {
  if (typeof input === 'string') {
    return {
      body: input,
      isAdvertisement: legacyOptions?.messageType === 'ad',
      attachments: legacyOptions?.attachments,
      sampleVariables: legacyOptions?.sampleVars,
      adCompanyName: legacyOptions?.adSenderLabel ?? SMS_SAMPLE_COMPANY_NAME,
    }
  }
  return input
}

export function calculateSmsMessageMeta(
  input: SmsMessageMetaInput | string,
  legacyOptions: SmsMessageMetaOptions = {},
  previousType: SmsTransportType | null = null,
): SmsMessageMeta {
  const normalized = normalizeInput(input, legacyOptions)
  const rawText = String(normalized.body ?? '')
  const attachments = normalized.attachments ?? []
  const hasAttachment = attachments.some(Boolean)
  const isAdvertisement = Boolean(normalized.isAdvertisement)
  const optOutNumber = normalized.optOutNumber?.trim() || SMS_AD_OPT_OUT_NUMBER

  const { text: previewBody, hasVariables } = applySmsTemplateVariables(
    rawText,
    normalized.sampleVariables ?? {},
  )

  const adCompanyName = normalized.adCompanyName?.trim() || SMS_SAMPLE_COMPANY_NAME
  let previewHeader: string | null = null
  let previewFooter: string | null = null
  let composedForBytes = previewBody

  if (isAdvertisement) {
    previewHeader = `(광고)${adCompanyName}`
    previewFooter = optOutNumber ? `무료거부 ${optOutNumber}` : null
    composedForBytes = [previewHeader, previewBody, previewFooter].filter(Boolean).join('\n')
  }

  const byteCount = estimateSmsByteLength(composedForBytes)
  const charCount = composedForBytes.length
  const messageType = resolveTransportType(byteCount, hasAttachment)
  const previewText = [previewHeader, previewBody, previewFooter].filter(Boolean).join('\n')

  return {
    rawText,
    previewText,
    renderedText: previewText,
    previewBody,
    previewHeader,
    previewFooter,
    charCount,
    byteCount,
    messageType,
    typeLabel: SMS_TRANSPORT_TYPE_LABELS[messageType],
    deductionLabel: SMS_DEDUCTION_LABELS[messageType],
    reason: buildTransitionReason(previousType, messageType, hasAttachment),
    limitByte: SMS_BYTE_LIMIT,
    isOverSmsLimit: !hasAttachment && byteCount > SMS_BYTE_LIMIT,
    hasAttachment,
    hasVariables,
    hasOptOut: isAdvertisement && Boolean(previewFooter),
    usesSampleSubstitution: hasVariables,
    transitionReason: buildTransitionReason(previousType, messageType, hasAttachment),
  }
}

export function detectTransportTransition(
  previous: SmsTransportType | null,
  next: SmsTransportType,
  hasAttachment: boolean,
): string | null {
  return buildTransitionReason(previous, next, hasAttachment)
}

/** @deprecated estimateSmsBytes alias */
export const estimateSmsBytes = estimateSmsByteLength

/** @deprecated */
export function detectSmsType(text: string): 'SMS' | 'LMS' {
  const meta = calculateSmsMessageMeta({ body: text })
  return meta.messageType === 'MMS' ? 'LMS' : meta.messageType
}
