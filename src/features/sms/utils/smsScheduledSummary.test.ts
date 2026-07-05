import { describe, expect, it } from 'vitest'
import { buildScheduleSummary, formatScheduleTimeLabel } from './smsScheduledSummary'

describe('smsScheduledSummary', () => {
  it('formats time label in Korean', () => {
    expect(formatScheduleTimeLabel('09:00')).toBe('오전 9:00')
    expect(formatScheduleTimeLabel('14:30')).toBe('오후 2:30')
  })

  it('summarizes once schedule', () => {
    expect(
      buildScheduleSummary({
        scheduleType: 'once',
        sendDate: '2026-07-10',
        sendTime: '14:00',
      }),
    ).toBe('2026-07-10 오후 2:00 발송')
  })

  it('summarizes daily schedule', () => {
    expect(
      buildScheduleSummary({
        scheduleType: 'daily',
        sendTime: '09:00',
      }),
    ).toBe('매일 오전 9:00 발송')
  })

  it('summarizes weekly schedule', () => {
    expect(
      buildScheduleSummary({
        scheduleType: 'weekly',
        weekdays: [1, 3, 5],
        sendTime: '15:00',
      }),
    ).toBe('매주 월/수/금 오후 3:00 발송')
  })

  it('summarizes monthly schedule', () => {
    expect(
      buildScheduleSummary({
        scheduleType: 'monthly',
        monthDay: 10,
        sendTime: '09:00',
      }),
    ).toBe('매월 10일 오전 9:00 발송')
  })
})
