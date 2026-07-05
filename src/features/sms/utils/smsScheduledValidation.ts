import type { SmsScheduledFormState } from '../types/smsScheduled.types'

export type SmsScheduledValidationResult = {
  valid: boolean
  missing: string[]
}

export function validateSmsScheduledForm(form: SmsScheduledFormState): SmsScheduledValidationResult {
  const missing: string[] = []

  if (!form.name.trim()) {
    missing.push('예약명')
  }
  if (!form.scheduleType) {
    missing.push('예약 주기')
  }
  if (!form.sendTime.trim()) {
    missing.push('발송 시간')
  }
  if (!form.recipientGroupId.trim()) {
    missing.push('연락처 그룹')
  }
  if (!form.messageBody.trim()) {
    missing.push('문자내용')
  }

  if (form.scheduleType === 'once' && !form.sendDate.trim()) {
    missing.push('발송 날짜')
  }
  if (form.scheduleType === 'weekly' && form.weekdays.length === 0) {
    missing.push('요일')
  }
  if (form.scheduleType === 'monthly' && !(form.monthDay >= 1 && form.monthDay <= 31)) {
    missing.push('매월 일자')
  }

  return { valid: missing.length === 0, missing }
}

export function isSmsScheduledFormValid(form: SmsScheduledFormState): boolean {
  return validateSmsScheduledForm(form).valid
}
