import { describe, expect, it } from 'vitest'
import { formatTodoCreatedDate } from './formatTodoCreatedDate'

describe('formatTodoCreatedDate', () => {
  it('formats date-only as YYYY-MM-DD (weekday)', () => {
    expect(formatTodoCreatedDate('2026-07-13')).toBe('2026-07-13 (월)')
    expect(formatTodoCreatedDate('2026-07-14')).toBe('2026-07-14 (화)')
    expect(formatTodoCreatedDate('2026-07-15')).toBe('2026-07-15 (수)')
    expect(formatTodoCreatedDate('2026-07-16')).toBe('2026-07-16 (목)')
    expect(formatTodoCreatedDate('2026-07-17')).toBe('2026-07-17 (금)')
    expect(formatTodoCreatedDate('2026-07-18')).toBe('2026-07-18 (토)')
    expect(formatTodoCreatedDate('2026-07-19')).toBe('2026-07-19 (일)')
  })

  it('uses KST calendar day for ISO timestamps (no time shown)', () => {
    // 2026-07-16T15:00:00Z = 2026-07-17 00:00 KST
    expect(formatTodoCreatedDate('2026-07-16T15:00:00.000Z')).toBe('2026-07-17 (금)')
    expect(formatTodoCreatedDate('2026-07-17T03:30:00.000Z')).toBe('2026-07-17 (금)')
  })

  it('returns em dash for empty values', () => {
    expect(formatTodoCreatedDate(null)).toBe('—')
    expect(formatTodoCreatedDate(undefined)).toBe('—')
    expect(formatTodoCreatedDate('')).toBe('—')
    expect(formatTodoCreatedDate('   ')).toBe('—')
  })
})
