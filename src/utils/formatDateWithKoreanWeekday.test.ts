import { describe, expect, it } from 'vitest'
import { formatDateWithKoreanWeekday } from './formatDateWithKoreanWeekday'

describe('formatDateWithKoreanWeekday', () => {
  it('formats date-only as YYYY-MM-DD (weekday)', () => {
    expect(formatDateWithKoreanWeekday('2026-07-13')).toBe('2026-07-13 (월)')
    expect(formatDateWithKoreanWeekday('2026-07-14')).toBe('2026-07-14 (화)')
    expect(formatDateWithKoreanWeekday('2026-07-15')).toBe('2026-07-15 (수)')
    expect(formatDateWithKoreanWeekday('2026-07-16')).toBe('2026-07-16 (목)')
    expect(formatDateWithKoreanWeekday('2026-07-17')).toBe('2026-07-17 (금)')
    expect(formatDateWithKoreanWeekday('2026-07-18')).toBe('2026-07-18 (토)')
    expect(formatDateWithKoreanWeekday('2026-07-19')).toBe('2026-07-19 (일)')
    expect(formatDateWithKoreanWeekday('2026-07-21')).toBe('2026-07-21 (화)')
  })

  it('does not shift date-only by timezone', () => {
    expect(formatDateWithKoreanWeekday('2026-07-21')).toBe('2026-07-21 (화)')
  })

  it('uses KST calendar day for ISO timestamps', () => {
    expect(formatDateWithKoreanWeekday('2026-07-16T15:00:00.000Z')).toBe('2026-07-17 (금)')
    expect(formatDateWithKoreanWeekday('2026-07-17T03:30:00.000Z')).toBe('2026-07-17 (금)')
  })

  it('returns em dash for empty values', () => {
    expect(formatDateWithKoreanWeekday(null)).toBe('—')
    expect(formatDateWithKoreanWeekday(undefined)).toBe('—')
    expect(formatDateWithKoreanWeekday('')).toBe('—')
    expect(formatDateWithKoreanWeekday('   ')).toBe('—')
  })
})
