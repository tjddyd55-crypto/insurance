import type { FormSelectOption } from '../../../components/form/FormSelect'
import { insertSmsMessageVariable } from '../utils/insertSmsMessageVariable'
import type {
  SmsAutomationRuleFormState,
  SmsAutomationSpecialDatePurposeType,
  SmsAutomationTriggerType,
} from '../types/smsAutomationRuleTypes'

export {
  getAutomationVariableOptions,
  SMS_COMMON_VARIABLE_OPTIONS,
  SMS_RESERVATION_VARIABLE_OPTIONS,
} from './smsVariables.config'

export type { SmsVariableOption } from '../types/smsVariable.types'

export const SMS_AUTOMATION_TRIGGER_TYPE_LABELS: Record<SmsAutomationTriggerType, string> = {
  BIRTHDAY: '생일',
  CAR_INSURANCE_EXPIRY: '자동차보험 만기',
  INSURANCE_AGE: '보험나이',
  CUSTOMER_SPECIAL_DATE: '고객 지정 기념일',
}

export const SMS_AUTOMATION_TRIGGER_TYPE_OPTIONS: FormSelectOption[] = (
  Object.keys(SMS_AUTOMATION_TRIGGER_TYPE_LABELS) as SmsAutomationTriggerType[]
).map((value) => ({
  value,
  label: SMS_AUTOMATION_TRIGGER_TYPE_LABELS[value],
}))

export const SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_LABELS: Record<
  SmsAutomationSpecialDatePurposeType,
  string
> = {
  ALL: '전체',
  CELEBRATION: '축하',
  THANKS: '감사',
  NOTICE: '안내',
  CHECKUP: '점검',
}

export const SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_OPTIONS: FormSelectOption[] = (
  Object.keys(SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_LABELS) as SmsAutomationSpecialDatePurposeType[]
).map((value) => ({
  value,
  label: SMS_AUTOMATION_SPECIAL_DATE_PURPOSE_LABELS[value],
}))

export const SMS_AUTOMATION_ACTIVE_OPTIONS: FormSelectOption[] = [
  { value: 'true', label: '가동중' },
  { value: 'false', label: '중지중' },
]

export const SMS_AUTOMATION_DEFAULT_MESSAGE_BY_TRIGGER: Record<SmsAutomationTriggerType, string> = {
  BIRTHDAY: `{고객명}님 생일을 진심으로 축하드립니다.
늘 건강하고 행복한 하루 보내세요.`,
  CAR_INSURANCE_EXPIRY: `{고객명}님 자동차보험 만기가 {만기일}에 도래합니다.
확인 필요하시면 연락 주세요.`,
  INSURANCE_AGE: `{고객명}님 보험나이 변경 전 안내드립니다.
필요하신 보장 점검이 있으시면 연락 주세요.`,
  CUSTOMER_SPECIAL_DATE: `{고객명}님, {기념일명}이 다가오고 있어 안내드립니다.
늘 좋은 하루 보내세요.`,
}

/** @deprecated SmsVariableOption 사용 */
export type SmsAutomationVariableOption = {
  label: string
  token: string
}

export function insertAutomationMessageVariable(
  messageBody: string,
  token: string,
  selectionStart: number,
  selectionEnd: number,
) {
  return insertSmsMessageVariable(messageBody, token, selectionStart, selectionEnd)
}

export function createEmptySmsAutomationRuleForm(
  triggerType: SmsAutomationTriggerType = 'BIRTHDAY',
): SmsAutomationRuleFormState {
  return {
    ruleName: '',
    triggerType,
    specialDatePurposeType: triggerType === 'CUSTOMER_SPECIAL_DATE' ? 'ALL' : null,
    dayOffset: 0,
    sendTime: '10:00',
    messageBody: SMS_AUTOMATION_DEFAULT_MESSAGE_BY_TRIGGER[triggerType],
    isActive: true,
    excludeMinors: false,
  }
}

export function labelForAutomationTriggerType(triggerType: SmsAutomationTriggerType): string {
  return SMS_AUTOMATION_TRIGGER_TYPE_LABELS[triggerType] ?? triggerType
}

export function formatAutomationDayOffsetLabel(dayOffset: number): string {
  if (dayOffset === 0) {
    return '당일'
  }
  return `D-${dayOffset}`
}

export function formatAutomationSendTimeLabel(sendTime: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(sendTime ?? '').trim())
  if (!match) {
    return sendTime
  }
  const hour = Number(match[1])
  const minute = match[2]
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${period} ${hour12}:${minute}`
}

export function formatAutomationUpdatedAt(iso: string | undefined | null): string {
  const raw = String(iso ?? '').trim()
  if (!raw) {
    return '—'
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function getAutomationPreviewBaseDateDefault(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function labelAutomationActiveState(isActive: boolean): string {
  return isActive ? '가동중' : '중지중'
}
