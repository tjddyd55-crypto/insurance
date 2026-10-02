import { describe, expect, it } from 'vitest'
import { weekendToneClass, weekendToneOf, weekendToneOfIndex } from './scheduleWeekend'

describe('요일 색 (일 빨강 · 토 파랑)', () => {
  it('2026-10: 3·10 토 → sat, 4·11 일 → sun, 평일 null', () => {
    expect(weekendToneOf('2026-10-03')).toBe('sat')
    expect(weekendToneOf('2026-10-10')).toBe('sat')
    expect(weekendToneOf('2026-10-04')).toBe('sun')
    expect(weekendToneOf('2026-10-11')).toBe('sun')
    expect(weekendToneOf('2026-10-05')).toBeNull()
    expect(weekendToneOf('2026-10-09')).toBeNull()
    expect(weekendToneOf('2026-10-02')).toBeNull()
  })
  it('머리글 index 0=일, 6=토, 잘못된 값은 null', () => {
    expect(weekendToneOfIndex(0)).toBe('sun')
    expect(weekendToneOfIndex(6)).toBe('sat')
    expect(weekendToneOfIndex(3)).toBeNull()
    expect(weekendToneOf('')).toBeNull()
    expect(weekendToneOf('not-a-date')).toBeNull()
    expect(weekendToneClass('sun')).toBe('schedule-page__tone--sun')
    expect(weekendToneClass(null)).toBe('')
  })
})
