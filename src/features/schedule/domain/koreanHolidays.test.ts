import { describe, expect, it } from 'vitest'
import { koreanHolidayName, readScheduleHolidayMode, scheduleDayTone, weekdayOfYmd, writeScheduleHolidayMode } from './koreanHolidays'

describe('koreanHolidays', () => {
  it('weekday', () => {
    expect(weekdayOfYmd('2026-10-11')).toBe(0)
    expect(weekdayOfYmd('2026-10-10')).toBe(6)
  })
  it('tone: sun red, sat blue, holiday red (holiday wins on Saturday)', () => {
    expect(scheduleDayTone('2026-10-11', 'kr')).toBe('sun')
    expect(scheduleDayTone('2026-10-10', 'kr')).toBe('sat')
    expect(scheduleDayTone('2026-10-09', 'kr')).toBe('holiday')
    expect(scheduleDayTone('2026-10-03', 'kr')).toBe('holiday')
    expect(scheduleDayTone('2026-10-12', 'kr')).toBe('')
  })
  it('personal setting none hides holidays but keeps weekend tones', () => {
    expect(koreanHolidayName('2026-10-09', 'none')).toBe('')
    expect(scheduleDayTone('2026-10-09', 'none')).toBe('')
    expect(scheduleDayTone('2026-10-03', 'none')).toBe('sat')
  })
  it('preference is per user and defaults to kr', () => {
    const m = new Map<string, string>()
    const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
    expect(readScheduleHolidayMode('u1', st)).toBe('kr')
    writeScheduleHolidayMode('u1', 'none', st)
    expect(readScheduleHolidayMode('u1', st)).toBe('none')
    expect(readScheduleHolidayMode('u2', st)).toBe('kr')
  })
})
