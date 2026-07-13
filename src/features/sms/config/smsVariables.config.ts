import type { FormSelectOption } from '../../../components/form/FormSelect'
import type { SmsAutomationTriggerType } from '../types/smsAutomationRuleTypes'
import type { SmsVariableOption } from '../types/smsVariable.types'

export const SMS_COMMON_VARIABLE_OPTIONS: SmsVariableOption[] = [
  { label: '고객명', token: '{고객명}' },
  { label: '담당자명', token: '{담당자명}' },
  { label: '담당자연락처', token: '{담당자연락처}' },
  { label: '기준일', token: '{기준일}' },
  { label: 'D일', token: '{D일}' },
]

/** 예약발송·템플릿 작성에서 노출하는 공통 변수 */
export const SMS_RESERVATION_VARIABLE_OPTIONS: SmsVariableOption[] = [...SMS_COMMON_VARIABLE_OPTIONS]

const SMS_AUTOMATION_TRIGGER_VARIABLE_OPTIONS: Record<SmsAutomationTriggerType, SmsVariableOption[]> = {
  BIRTHDAY: [{ label: '생일', token: '{생일}' }],
  CAR_INSURANCE_EXPIRY: [
    { label: '만기일', token: '{만기일}' },
    { label: '차량번호', token: '{차량번호}' },
    { label: '보험회사', token: '{보험회사}' },
  ],
  INSURANCE_AGE: [
    { label: '보험나이', token: '{보험나이}' },
    { label: '보험나이변경일', token: '{보험나이변경일}' },
  ],
  CUSTOMER_SPECIAL_DATE: [
    { label: '기념일명', token: '{기념일명}' },
    { label: '타이틀', token: '{타이틀}' },
    { label: '기념일날짜', token: '{기념일날짜}' },
  ],
}

export function getAutomationVariableOptions(triggerType: SmsAutomationTriggerType): SmsVariableOption[] {
  return [...SMS_COMMON_VARIABLE_OPTIONS, ...SMS_AUTOMATION_TRIGGER_VARIABLE_OPTIONS[triggerType]]
}

export const SMS_VARIABLE_BUTTONS_DEFAULT_HINT =
  '버튼을 누르면 문자 내용에 변수가 추가됩니다. 발송 시 각 고객 정보로 치환됩니다.'

export const SMS_VARIABLE_BUTTONS_AUTOMATION_HINT =
  '버튼을 누르면 문자 내용에 변수가 추가됩니다. 미리보기에서 실제 고객 정보로 치환됩니다.'
