import { describe, expect, it } from 'vitest'
import { monthGridRange, viewQueryRange, weekRange } from './scheduleRange'

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
})
