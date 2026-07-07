import { describe, expect, it } from 'vitest'
import { EMPTY_SMS_SCHEDULED_FORM } from '../types/smsScheduled.types'
import { isSmsScheduledFormValid, validateSmsScheduledForm, validateSmsScheduledSave } from './smsScheduledValidation'

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

describe('validateSmsScheduledSave', () => {
  const baseForm = {
    ...EMPTY_SMS_SCHEDULED_FORM,
    name: '테스트 예약',
    sendDate: '2099-12-31',
    sendTime: '09:00',
    messageBody: '안내 메시지',
  }

  it('enables save when group is selected via context and sendable count > 0', () => {
    const result = validateSmsScheduledSave({
      form: { ...baseForm, recipientGroupId: '' },
      recipientGroupId: '12',
      sendableCount: 1,
    })
    expect(result.canSave).toBe(true)
    expect(result.disabledReason).toBeNull()
  })

  it('disables save when group is missing', () => {
    const result = validateSmsScheduledSave({
      form: baseForm,
      recipientGroupId: '',
      sendableCount: 1,
    })
    expect(result.canSave).toBe(false)
    expect(result.disabledReason).toBe('대상 그룹을 선택해 주세요.')
  })

  it('disables save when message is empty', () => {
    const result = validateSmsScheduledSave({
      form: { ...baseForm, messageBody: '' },
      recipientGroupId: '12',
      sendableCount: 1,
    })
    expect(result.canSave).toBe(false)
    expect(result.disabledReason).toBe('메시지 내용을 입력해 주세요.')
  })

  it('disables save when sendable count is zero', () => {
    const result = validateSmsScheduledSave({
      form: { ...baseForm, recipientGroupId: '12' },
      sendableCount: 0,
    })
    expect(result.canSave).toBe(false)
    expect(result.disabledReason).toBe('발송 가능한 대상이 없습니다.')
  })

  it('disables save when scheduled time is in the past', () => {
    const result = validateSmsScheduledSave({
      form: {
        ...baseForm,
        recipientGroupId: '12',
        sendDate: '2000-01-01',
        sendTime: '09:00',
      },
      sendableCount: 1,
    })
    expect(result.canSave).toBe(false)
    expect(result.disabledReason).toBe('예약 발송 시간은 현재 시각 이후여야 합니다.')
  })
})
