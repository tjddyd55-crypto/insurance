import { describe, expect, it } from 'vitest'
import { belongsToWeek, isDueInWeek, shiftWeekStart, weeklyMovePlan, formatWeekRangeLabel, isManualWeeklyFocus, mondayOfYmd } from './weeklyFocus'

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
  it('주 이동(월요일 기준)', () => {
    expect(shiftWeekStart('2026-11-02', -1)).toBe('2026-10-26')
    expect(shiftWeekStart('2026-11-02', 1)).toBe('2026-11-09')
    expect(shiftWeekStart('2026-12-28', 1)).toBe('2027-01-04')
  })
  it('이동 정책: 직접 지정은 실제 이동, 날짜 기준은 다른 주에도 보기', () => {
    expect(weeklyMovePlan({ dueDate: null, weeklyFocusWeekStart: '2026-11-02' }, '2026-11-02', 1))
      .toEqual({ target: '2026-11-09', staysInThisWeek: false, label: '다음 주로' })
    expect(weeklyMovePlan({ dueDate: '2026-11-04', weeklyFocusWeekStart: null }, '2026-11-02', -1))
      .toEqual({ target: '2026-10-26', staysInThisWeek: true, label: '이전 주에도 보기' })
    expect(isDueInWeek({ dueDate: '2026-11-09' }, '2026-11-02')).toBe(false)
  })
})
