import { describe, expect, it } from 'vitest'
import { defaultNewItemDate, isValidDateString, normalizeDateInput } from './dateInput'

describe('normalizeDateInput', () => {
  it('formats continuous digits into YYYY-MM-DD', () => {
    expect(normalizeDateInput('20260708')).toBe('2026-07-08')
    expect(normalizeDateInput('2026-07-08')).toBe('2026-07-08')
    expect(normalizeDateInput('202607081234')).toBe('2026-07-08')
    expect(normalizeDateInput('1926211203')).toBe('1926-21-12')
  })

  it('builds partial input progressively', () => {
    expect(normalizeDateInput('2')).toBe('2')
    expect(normalizeDateInput('2026')).toBe('2026')
    expect(normalizeDateInput('20267')).toBe('2026-7')
    expect(normalizeDateInput('202607')).toBe('2026-07')
  })

  it('strips non-digit characters', () => {
    expect(normalizeDateInput('2026년07월08일')).toBe('2026-07-08')
    expect(normalizeDateInput('abc20260708xyz')).toBe('2026-07-08')
  })
})

describe('defaultNewItemDate', () => {
  it('일정·할 일 추가: 고른 날이 있으면 그대로, 없으면 오늘(KST)', () => {
    const kstMorning = new Date('2026-10-13T15:30:00Z')
    expect(defaultNewItemDate('2026-11-02', kstMorning)).toBe('2026-11-02')
    expect(defaultNewItemDate('', kstMorning)).toBe('2026-10-14')
    expect(defaultNewItemDate(null, kstMorning)).toBe('2026-10-14')
  })
})

describe('isValidDateString', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDateString('2026-07-08')).toBe(true)
    expect(isValidDateString('2026-02-29')).toBe(false)
  })

  it('rejects malformed strings', () => {
    expect(isValidDateString('2026-7-8')).toBe(false)
    expect(isValidDateString('20260708')).toBe(false)
  })
})
