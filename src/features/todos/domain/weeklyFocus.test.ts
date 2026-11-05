import { describe, expect, it } from 'vitest'
import { belongsToWeek, formatWeekRangeLabel, isManualWeeklyFocus, mondayOfYmd } from './weeklyFocus'

describe('weeklyFocus', () => {
  it('월요일 시작(월~일)', () => {
    expect(mondayOfYmd('2026-11-02')).toBe('2026-11-02')
    expect(mondayOfYmd('2026-11-08')).toBe('2026-11-02')
    expect(mondayOfYmd('2026-11-01')).toBe('2026-10-26')
    expect(mondayOfYmd('2027-01-01')).toBe('2026-12-28')
  })
  it('범위 라벨', () => {
    expect(formatWeekRangeLabel('2026-11-02')).toBe('11.02 ~ 11.08')
    expect(formatWeekRangeLabel('2026-12-28')).toBe('12.28 ~ 01.03')
  })
  it('자동(예정일) / 수동(직접 지정)', () => {
    expect(belongsToWeek({ dueDate: '2026-11-08', weeklyFocusWeekStart: null }, '2026-11-02')).toBe(true)
    expect(belongsToWeek({ dueDate: '2026-11-09', weeklyFocusWeekStart: null }, '2026-11-02')).toBe(false)
    expect(belongsToWeek({ dueDate: null, weeklyFocusWeekStart: '2026-11-02' }, '2026-11-02')).toBe(true)
    expect(isManualWeeklyFocus({ weeklyFocusWeekStart: '2026-11-02' }, '2026-11-02')).toBe(true)
    expect(isManualWeeklyFocus({ weeklyFocusWeekStart: null }, '2026-11-02')).toBe(false)
  })
})
