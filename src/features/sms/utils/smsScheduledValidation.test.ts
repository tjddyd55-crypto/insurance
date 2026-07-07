import { describe, expect, it } from 'vitest'
import { EMPTY_SMS_SCHEDULED_FORM } from '../types/smsScheduled.types'
import { isSmsScheduledFormValid, validateSmsScheduledForm } from './smsScheduledValidation'

describe('smsScheduledValidation', () => {
  it('requires common fields', () => {
    const result = validateSmsScheduledForm({ ...EMPTY_SMS_SCHEDULED_FORM })
    expect(result.valid).toBe(false)
    expect(result.missing).toEqual(
      expect.arrayContaining(['예약명', '연락처 그룹', '문자내용', '발송 날짜']),
    )
  })

  it('validates once schedule with all required fields', () => {
    const form = {
      ...EMPTY_SMS_SCHEDULED_FORM,
      name: '만기 안내',
      sendDate: '2026-07-10',
      recipientGroupId: '12',
      messageBody: '안내 문자',
    }
    expect(isSmsScheduledFormValid(form)).toBe(true)
  })

  it('requires weekdays for weekly schedule', () => {
    const form = {
      ...EMPTY_SMS_SCHEDULED_FORM,
      name: '주간 안내',
      scheduleType: 'weekly' as const,
      recipientGroupId: '3',
      messageBody: '본문',
      weekdays: [],
    }
    const result = validateSmsScheduledForm(form)
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('요일')
  })
})
