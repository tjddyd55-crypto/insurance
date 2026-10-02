import { describe, expect, it } from 'vitest'
import { monthGridRange, periodTitle, shiftAnchor, viewQueryRange, weekRange } from './scheduleRange'

describe('schedule range', () => {
  it('월간 그리드·주간·일간 구간이 서버와 같다', () => {
    expect(monthGridRange('2026-10-15')).toMatchObject({
      start: '2026-09-27',
      end: '2026-11-07',
      monthStart: '2026-10-01',
      monthEnd: '2026-10-31',
    })
    expect(weekRange('2026-10-15')).toEqual({ start: '2026-10-12', end: '2026-10-18' })
    expect(viewQueryRange('day', '2026-10-15')).toEqual({ start: '2026-10-15', end: '2026-10-15' })
    expect(viewQueryRange('list', '2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('기간 제목과 이전/다음 이동(월 경계·연 경계)', () => {
    expect(periodTitle('month', '2026-10-02')).toBe('2026년 10월')
    expect(periodTitle('week', '2026-10-02')).toBe('2026.09.28 – 10.04')
    expect(periodTitle('week', '2026-12-31')).toBe('2026.12.28 – 2027.01.03')
    expect(periodTitle('day', '2026-10-02')).toBe('2026년 10월 2일 (금)')
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-01')
    expect(shiftAnchor('week', '2026-10-30', 1)).toBe('2026-11-06')
    expect(shiftAnchor('day', '2026-10-31', 1)).toBe('2026-11-01')
  })
})
