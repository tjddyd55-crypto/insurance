import {
  SMS_AD_DISPLAY_NAME_PLACEHOLDER,
  SMS_AD_OPT_OUT_NUMBER,
  SMS_BYTE_LIMIT,
  SMS_DEDUCTION_LABELS,
  SMS_TRANSPORT_TYPE_LABELS,
} from '../config/smsCompose.config'
import {
  applySmsTemplateVariables,
  resolvePreviewSubstitutionNotice,
  type SmsPreviewSubstitution,
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
  previewSubstitution?: SmsPreviewSubstitution
  /** @deprecated previewSubstitution 사용 */
  sampleVariables?: Partial<Record<SmsTemplateVariableKey, string>>
  /** 문자 설정에 저장된 광고 표시명 (1순위) */
  adDisplayName?: string | null
  /** @deprecated adDisplayName 사용 */
  adCompanyName?: string | null
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
  previewSubstitutionNotice: string | null
  adDisplayNameMissing: boolean
  adDisplayNameNotice: string | null
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
  variablesSubstituted: boolean
  /** @deprecated variablesSubstituted 사용 */
  usesSampleSubstitution: boolean
  transitionReason: string | null
}

export function resolveSmsAdDisplayName(options: {
  savedAdDisplayName?: string | null
  userDisplayName?: string | null
  organizationDisplayName?: string | null
}): string | null {
  const saved = String(options.savedAdDisplayName ?? '').trim()
  if (saved) {
    return saved
  }
  const userDisplay = String(options.userDisplayName ?? '').trim()
  if (userDisplay) {
    return userDisplay
  }
  const organizationDisplay = String(options.organizationDisplayName ?? '').trim()
  if (organizationDisplay) {
    return organizationDisplay
  }
  return null
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

function normalizeSubstitution(input: SmsMessageMetaInput): SmsPreviewSubstitution {
  if (input.previewSubstitution) {
    return input.previewSubstitution
  }
  if (input.sampleVariables && Object.keys(input.sampleVariables).length > 0) {
    return {
      mode: 'selectedCustomer',
      values: input.sampleVariables,
      selectedCustomerName: input.sampleVariables.customerName ?? null,
    }
  }
  return { mode: 'preserve' }
}

function normalizeInput(input: SmsMessageMetaInput | string, legacyOptions?: SmsMessageMetaOptions): SmsMessageMetaInput {
  if (typeof input === 'string') {
    return {
      body: input,
      isAdvertisement: legacyOptions?.messageType === 'ad',
      attachments: legacyOptions?.attachments,
      sampleVariables: legacyOptions?.sampleVars,
      adDisplayName: legacyOptions?.adSenderLabel ?? null,
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
  const previewSubstitution = normalizeSubstitution(normalized)

  const { text: previewBody, hasVariables, variablesSubstituted } = applySmsTemplateVariables(
    rawText,
    previewSubstitution,
  )
  const previewSubstitutionNotice = resolvePreviewSubstitutionNotice(previewSubstitution)

  const resolvedAdDisplayName =
    normalized.adDisplayName?.trim() ||
    normalized.adCompanyName?.trim() ||
    null
  const adDisplayNameMissing = isAdvertisement && !resolvedAdDisplayName
  const adDisplayNameNotice = adDisplayNameMissing
    ? '광고 표시명이 없습니다. 문자 설정에서 광고 표시명을 입력해 주세요.'
    : null

  let previewHeader: string | null = null
  let previewFooter: string | null = null
  let composedForBytes = rawText

  if (isAdvertisement) {
    const headerLabel = resolvedAdDisplayName ?? SMS_AD_DISPLAY_NAME_PLACEHOLDER
    previewHeader = `(광고)${headerLabel}`
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
    previewSubstitutionNotice,
    adDisplayNameMissing,
    adDisplayNameNotice,
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
    variablesSubstituted,
    usesSampleSubstitution: variablesSubstituted,
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
