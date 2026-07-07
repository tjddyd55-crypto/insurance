import { SMS_EXPLICIT_SAMPLE_VALUES } from '../config/smsCompose.config'

export type SmsTemplateVariableKey =
  | 'customerName'
  | 'agentName'
  | 'companyName'
  | 'senderName'
  | 'claimLink'
  | 'reservationDate'
  | 'memo'

export type SmsPreviewSubstitutionMode = 'preserve' | 'selectedCustomer' | 'explicitSample'

export type SmsPreviewSubstitution = {
  mode: SmsPreviewSubstitutionMode
  /** selectedCustomer / explicitSample 치환값 */
  values?: Partial<Record<SmsTemplateVariableKey, string>>
  /** 미리보기 안내 문구용 */
  selectedCustomerName?: string | null
}

export type SmsTemplateVariableDef = {
  id: SmsTemplateVariableKey
  token: string
  aligoLabel: string
  chipLabel: string
  enabled: boolean
  disabledReason?: string
}

/** UI 칩으로 노출·삽입 가능한 변수 (초기 버전: 고객명만) */
export const SMS_ENABLED_TEMPLATE_VARIABLES: SmsTemplateVariableDef[] = [
  {
    id: 'customerName',
    token: '{고객명}',
    aligoLabel: '%고객명%',
    chipLabel: '고객명',
    enabled: true,
  },
]

export const SMS_TEMPLATE_VARIABLES: SmsTemplateVariableDef[] = [
  {
    id: 'customerName',
    token: '{고객명}',
    aligoLabel: '%고객명%',
    chipLabel: '고객명',
    enabled: true,
  },
  {
    id: 'agentName',
    token: '{담당자명}',
    aligoLabel: '%담당자명%',
    chipLabel: '담당자명',
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'companyName',
    token: '{회사명}',
    aligoLabel: '%회사명%',
    chipLabel: '회사명',
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'senderName',
    token: '{발신자명}',
    aligoLabel: '%발신자명%',
    chipLabel: '발신자명',
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'claimLink',
    token: '{청구링크}',
    aligoLabel: '%청구링크%',
    chipLabel: '청구링크',
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'reservationDate',
    token: '{예약일}',
    aligoLabel: '%예약일%',
    chipLabel: '예약일',
    enabled: false,
    disabledReason: '후속 연동 예정',
  },
  {
    id: 'memo',
    token: '{메모}',
    aligoLabel: '%메모%',
    chipLabel: '메모',
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

const LEGACY_INSURER_PATTERNS = [/\{보험사명\}/g, /%보험사명%/g]

function detectTemplateVariables(text: string): boolean {
  for (const { patterns } of TOKEN_PATTERNS) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      if (pattern.test(text)) {
        return true
      }
    }
  }
  for (const pattern of LEGACY_INSURER_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(text)) {
      return true
    }
  }
  return false
}

function replaceWithMap(
  text: string,
  valueMap: Partial<Record<SmsTemplateVariableKey, string>>,
  includeLegacyInsurer: boolean,
): { text: string; substituted: boolean } {
  let next = text
  let substituted = false

  for (const { key, patterns } of TOKEN_PATTERNS) {
    const value = valueMap[key]
    if (value == null || value === '') {
      continue
    }
    for (const pattern of patterns) {
      const replaced = next.replace(pattern, value)
      if (replaced !== next) {
        substituted = true
        next = replaced
      }
    }
  }

  if (includeLegacyInsurer && valueMap.companyName) {
    const legacy = next
      .replace(/\{보험사명\}/g, valueMap.companyName)
      .replace(/%보험사명%/g, valueMap.companyName)
    if (legacy !== next) {
      substituted = true
      next = legacy
    }
  }

  return { text: next, substituted }
}

export function buildExplicitSampleVariableMap(): Record<SmsTemplateVariableKey, string> {
  return { ...SMS_EXPLICIT_SAMPLE_VALUES }
}

export function resolvePreviewSubstitutionNotice(
  substitution: SmsPreviewSubstitution = { mode: 'preserve' },
): string | null {
  if (substitution.mode === 'preserve') {
    return '고객이 선택되지 않아 치환 변수는 그대로 표시됩니다.'
  }
  if (substitution.mode === 'selectedCustomer') {
    const name = substitution.selectedCustomerName?.trim()
    return name ? `미리보기 기준 고객: ${name}` : null
  }
  if (substitution.mode === 'explicitSample') {
    return '샘플 미리보기입니다. 실제 발송 시 고객별 값으로 치환됩니다.'
  }
  return null
}

export function applySmsTemplateVariables(
  template: string,
  substitution: SmsPreviewSubstitution = { mode: 'preserve' },
): { text: string; hasVariables: boolean; variablesSubstituted: boolean } {
  const raw = String(template ?? '')
  const hasVariables = detectTemplateVariables(raw)

  if (substitution.mode === 'preserve') {
    return { text: raw, hasVariables, variablesSubstituted: false }
  }

  if (substitution.mode === 'selectedCustomer') {
    const { text, substituted } = replaceWithMap(raw, substitution.values ?? {}, false)
    return { text, hasVariables, variablesSubstituted: substituted }
  }

  const explicitValues = {
    ...buildExplicitSampleVariableMap(),
    ...(substitution.values ?? {}),
  }
  const { text, substituted } = replaceWithMap(raw, explicitValues, true)
  return { text, hasVariables, variablesSubstituted: substituted }
}
