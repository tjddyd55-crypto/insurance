import { describe, expect, it } from 'vitest'
import {
  belongsToWeek,
  formatWeekRangeLabel,
  mondayOfYmd,
  shiftWeekStart,
  storedWeekKey,
  uiWeekStartOfYmd,
  weeklyMoveTarget,
  sortWeeklyTodos,
} from './weeklyFocus'

describe('weeklyFocus', () => {
  it('화면 주는 일요일, 저장 키는 그 주의 월요일', () => {
    expect(uiWeekStartOfYmd('2026-11-08')).toBe('2026-11-08')
    expect(uiWeekStartOfYmd('2026-11-14')).toBe('2026-11-08')
    expect(storedWeekKey('2026-11-08')).toBe('2026-11-09')
    expect(storedWeekKey('2026-11-14')).toBe('2026-11-09')
    expect(mondayOfYmd('2026-11-02')).toBe('2026-11-02')
    expect(mondayOfYmd('2026-11-08')).toBe('2026-11-02')
  })

  it('기존 월요일 키는 그 월요일이 들어 있는 일~토에 그대로 보인다', () => {
    expect(formatWeekRangeLabel('2026-11-02')).toBe('11.01 ~ 11.07')
    expect(formatWeekRangeLabel('2026-11-01')).toBe('11.01 ~ 11.07')
    expect(formatWeekRangeLabel('2026-11-08')).toBe('11.08 ~ 11.14')
    expect(formatWeekRangeLabel('2026-12-28')).toBe('12.27 ~ 01.02')
    expect(belongsToWeek({ weeklyFocusWeekStart: '2026-11-02' }, '2026-11-01')).toBe(true)
    expect(belongsToWeek({ weeklyFocusWeekStart: '2026-11-02' }, '2026-11-02')).toBe(true)
    expect(belongsToWeek({ weeklyFocusWeekStart: '2026-11-01' }, '2026-11-01')).toBe(true)
    expect(belongsToWeek({ weeklyFocusWeekStart: '2026-11-02' }, '2026-11-08')).toBe(false)
    expect(belongsToWeek({ weeklyFocusWeekStart: null }, '2026-11-01')).toBe(false)
  })

  it('정렬: 미완료 먼저, 완료 뒤', () => {
    const rows = [{ id: 'a', status: 'completed' }, { id: 'b', status: 'pending' }, { id: 'c', status: 'pending' }] as const
    expect(sortWeeklyTodos([...rows]).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('화면 이전/다음은 일요일, 저장 이동은 월요일', () => {
    expect(shiftWeekStart('2026-11-08', -1)).toBe('2026-11-01')
    expect(shiftWeekStart('2026-11-08', 1)).toBe('2026-11-15')
    expect(shiftWeekStart('2026-11-02', 1)).toBe('2026-11-08')
    expect(weeklyMoveTarget('2026-11-08', 1)).toEqual({ target: '2026-11-16', label: '다음 주로' })
    expect(weeklyMoveTarget('2026-11-08', -1)).toEqual({ target: '2026-11-02', label: '이전 주로' })
    expect(weeklyMoveTarget('2026-11-02', 1)).toEqual({ target: '2026-11-09', label: '다음 주로' })
    expect(weeklyMoveTarget('2026-11-02', -1)).toEqual({ target: '2026-10-26', label: '이전 주로' })
  })
})
