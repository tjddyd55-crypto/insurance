import { describe, expect, it } from 'vitest'
import { belongsToWeek, shiftWeekStart, weeklyMoveTarget, formatWeekRangeLabel, mondayOfYmd, sortWeeklyTodos } from './weeklyFocus'

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
  it('주간 소속: 그 주로 지정한 것만(예정일 자동 포함 없음)', () => {
    expect(belongsToWeek({ weeklyFocusWeekStart: '2026-11-02' }, '2026-11-02')).toBe(true)
    expect(belongsToWeek({ weeklyFocusWeekStart: null }, '2026-11-02')).toBe(false)
    expect(belongsToWeek({ weeklyFocusWeekStart: '2026-11-09' }, '2026-11-02')).toBe(false)
  })
  it('정렬: 미완료 먼저, 완료 뒤', () => {
    const rows = [{ id: 'a', status: 'completed' }, { id: 'b', status: 'pending' }, { id: 'c', status: 'pending' }] as const
    expect(sortWeeklyTodos([...rows]).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
  it('주 이동(월요일 기준)', () => {
    expect(shiftWeekStart('2026-11-02', -1)).toBe('2026-10-26')
    expect(shiftWeekStart('2026-11-02', 1)).toBe('2026-11-09')
    expect(shiftWeekStart('2026-12-28', 1)).toBe('2027-01-04')
  })
  it('이전/다음 주 이동: 지정 주만 ±1주', () => {
    expect(weeklyMoveTarget('2026-11-02', 1)).toEqual({ target: '2026-11-09', label: '다음 주로' })
    expect(weeklyMoveTarget('2026-11-02', -1)).toEqual({ target: '2026-10-26', label: '이전 주로' })
  })
})
