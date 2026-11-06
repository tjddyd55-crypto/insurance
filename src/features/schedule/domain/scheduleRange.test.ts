import { describe, expect, it } from 'vitest'
import { monthGridRange, periodTitle, shiftAnchor, viewQueryRange, weekDays, weekRange } from './scheduleRange'

describe('schedule range', () => {
  it('월간·일간 구간과 주간(일~토) 조회 범위', () => {
    expect(monthGridRange('2026-10-15')).toMatchObject({
      start: '2026-09-27',
      end: '2026-11-07',
      monthStart: '2026-10-01',
      monthEnd: '2026-10-31',
    })
    expect(weekRange('2026-10-15')).toEqual({ start: '2026-10-11', end: '2026-10-17' })
    expect(viewQueryRange('day', '2026-10-15')).toEqual({ start: '2026-10-15', end: '2026-10-15' })
    expect(viewQueryRange('list', '2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('기간 제목과 이전/다음 이동(월 경계·연 경계)', () => {
    expect(periodTitle('month', '2026-10-02')).toBe('2026년 10월')
    expect(periodTitle('week', '2026-10-02')).toBe('2026.09.27 – 10.03')
    expect(periodTitle('week', '2026-12-31')).toBe('2026.12.27 – 2027.01.02')
    expect(periodTitle('day', '2026-10-02')).toBe('2026년 10월 2일 (금)')
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-01')
    expect(shiftAnchor('week', '2026-10-30', 1)).toBe('2026-11-06')
    expect(shiftAnchor('day', '2026-10-31', 1)).toBe('2026-11-01')
  })

  it('주간은 일요일 시작(일~토): 11/08~11/14, 이전·다음, 월·연 경계', () => {
    expect(weekRange('2026-11-08')).toEqual({ start: '2026-11-08', end: '2026-11-14' })
    expect(weekRange('2026-11-11')).toEqual({ start: '2026-11-08', end: '2026-11-14' })
    expect(weekRange(shiftAnchor('week', '2026-11-08', -1))).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weekRange(shiftAnchor('week', '2026-11-08', 1))).toEqual({ start: '2026-11-15', end: '2026-11-21' })
    expect(weekDays('2026-11-08')).toEqual([
      '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14',
    ])
    expect(weekRange('2026-10-12')).toEqual({ start: '2026-10-11', end: '2026-10-17' })
    expect(weekRange('2026-10-18')).toEqual({ start: '2026-10-18', end: '2026-10-24' })
    expect(weekRange('2026-11-02')).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weekRange('2026-11-01')).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weekRange('2026-10-01')).toEqual({ start: '2026-09-27', end: '2026-10-03' })
    expect(weekRange('2027-01-01')).toEqual({ start: '2026-12-27', end: '2027-01-02' })
    expect(weekRange('2027-01-04')).toEqual({ start: '2027-01-03', end: '2027-01-09' })
    expect(weekRange('2028-03-01')).toEqual({ start: '2028-02-27', end: '2028-03-04' })
    expect(viewQueryRange('week', '2026-12-31')).toEqual({ start: '2026-12-27', end: '2027-01-02' })
    expect(weekDays('2026-12-31')).toEqual([
      '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ])
    for (const ymd of ['2026-10-02', '2026-11-08', '2027-01-03', '2028-02-27']) {
      const [y, m, d] = weekRange(ymd).start.split('-').map(Number)
      expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(0)
    }
    expect(viewQueryRange('day', '2026-11-08')).toEqual({ start: '2026-11-08', end: '2026-11-08' })
    expect(new Date(`${monthGridRange('2026-11-15').start}T00:00:00Z`).getUTCDay()).toBe(0)
  })

  it('주간 이전/다음은 일요일 주 단위로 맞물린다', () => {
    expect(weekRange(shiftAnchor('week', '2026-11-01', 1))).toEqual({ start: '2026-11-08', end: '2026-11-14' })
    expect(weekRange(shiftAnchor('week', '2026-11-08', -1))).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weekRange(shiftAnchor('week', '2026-12-27', 1))).toEqual({ start: '2027-01-03', end: '2027-01-09' })
    expect(periodTitle('week', shiftAnchor('week', '2026-12-27', 1))).toBe('2027.01.03 – 01.09')
  })
})
