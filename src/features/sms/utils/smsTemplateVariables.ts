import {
  SMS_SAMPLE_AGENT_NAME,
  SMS_SAMPLE_CLAIM_LINK,
  SMS_SAMPLE_COMPANY_NAME,
  SMS_SAMPLE_CUSTOMER_NAME,
} from '../config/smsCompose.config'

export type SmsTemplateVariableKey =
  | 'customerName'
  | 'agentName'
  | 'companyName'
  | 'senderName'
  | 'claimLink'
  | 'reservationDate'
  | 'memo'

export type SmsTemplateVariableDef = {
  id: SmsTemplateVariableKey
  token: string
  aligoLabel: string
  chipLabel: string
  sampleValue: string
  enabled: boolean
  disabledReason?: string
}

export const SMS_TEMPLATE_VARIABLES: SmsTemplateVariableDef[] = [
  {
    id: 'customerName',
    token: '{고객명}',
    aligoLabel: '%고객명%',
    chipLabel: '고객명',
    sampleValue: SMS_SAMPLE_CUSTOMER_NAME,
    enabled: true,
  },
  {
    id: 'agentName',
    token: '{담당자명}',
    aligoLabel: '%담당자명%',
    chipLabel: '담당자명',
    sampleValue: SMS_SAMPLE_AGENT_NAME,
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'companyName',
    token: '{회사명}',
    aligoLabel: '%회사명%',
    chipLabel: '회사명',
    sampleValue: SMS_SAMPLE_COMPANY_NAME,
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'senderName',
    token: '{발신자명}',
    aligoLabel: '%발신자명%',
    chipLabel: '발신자명',
    sampleValue: SMS_SAMPLE_AGENT_NAME,
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'claimLink',
    token: '{청구링크}',
    aligoLabel: '%청구링크%',
    chipLabel: '청구링크',
    sampleValue: SMS_SAMPLE_CLAIM_LINK,
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'reservationDate',
    token: '{예약일}',
    aligoLabel: '%예약일%',
    chipLabel: '예약일',
    sampleValue: '2026-06-30',
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'memo',
    token: '{메모}',
    aligoLabel: '%메모%',
    chipLabel: '메모',
    sampleValue: '메모 샘플',
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
]

const TOKEN_PATTERNS: Array<{ key: SmsTemplateVariableKey; patterns: RegExp[] }> =
  SMS_TEMPLATE_VARIABLES.map((item) => ({
    key: item.id,
    patterns: [
      new RegExp(item.token.replace(/[{}]/g, '\\$&'), 'g'),
      new RegExp(item.aligoLabel.replace(/[%]/g, '\\%'), 'g'),
    ],
  }))

export function applySmsTemplateVariables(
  template: string,
  sampleOverrides: Partial<Record<SmsTemplateVariableKey, string>> = {},
): { text: string; hasVariables: boolean } {
  let text = String(template ?? '')
  let hasVariables = false
  const sampleMap = Object.fromEntries(
    SMS_TEMPLATE_VARIABLES.map((item) => [item.id, sampleOverrides[item.id] ?? item.sampleValue]),
  ) as Record<SmsTemplateVariableKey, string>

  for (const { key, patterns } of TOKEN_PATTERNS) {
    for (const pattern of patterns) {
      const next = text.replace(pattern, sampleMap[key])
      if (next !== text) {
        hasVariables = true
        text = next
      }
    }
  }

  const legacyInsurer = text
    .replace(/\{보험사명\}/g, SMS_SAMPLE_COMPANY_NAME)
    .replace(/%보험사명%/g, SMS_SAMPLE_COMPANY_NAME)
  if (legacyInsurer !== text) {
    hasVariables = true
    text = legacyInsurer
  }

  return { text, hasVariables }
}
