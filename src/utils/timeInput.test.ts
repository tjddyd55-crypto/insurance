import { describe, expect, it } from 'vitest'
import {
  formatKoreanClock,
  parseHm24,
  readDraftNumber,
  shiftHour12,
  shiftMinute,
  toHm24,
} from './timeInput'

describe('timeInput', () => {
  it('maps 24-hour storage to 오전/오후 without shifting the clock', () => {
    expect(formatKoreanClock('00:00')).toBe('오전 12:00')
    expect(formatKoreanClock('09:05')).toBe('오전 9:05')
    expect(formatKoreanClock('12:00')).toBe('오후 12:00')
    expect(formatKoreanClock('13:30')).toBe('오후 1:30')
    expect(formatKoreanClock('23:59')).toBe('오후 11:59')
  })

  it('round-trips 오전/오후 back to HH:mm', () => {
    expect(toHm24({ hour12: 12, minute: 0, meridiem: 'am' })).toBe('00:00')
    expect(toHm24({ hour12: 9, minute: 5, meridiem: 'am' })).toBe('09:05')
    expect(toHm24({ hour12: 12, minute: 0, meridiem: 'pm' })).toBe('12:00')
    expect(toHm24({ hour12: 1, minute: 30, meridiem: 'pm' })).toBe('13:30')
    expect(toHm24({ hour12: 11, minute: 59, meridiem: 'pm' })).toBe('23:59')
  })

  it('rejects empty and out-of-range storage values', () => {
    expect(parseHm24('')).toBeNull()
    expect(parseHm24('24:00')).toBeNull()
    expect(parseHm24('09:60')).toBeNull()
    expect(formatKoreanClock(null)).toBe('')
  })

  it('keeps partial keyboard drafts and clamps on the edges', () => {
    expect(readDraftNumber('')).toBeNull()
    expect(readDraftNumber('0')).toBe(0)
    expect(readDraftNumber('15시')).toBe(15)
    expect(shiftHour12(12, 1)).toBe(1)
    expect(shiftHour12(1, -1)).toBe(12)
    expect(shiftMinute(59, 1)).toBe(0)
    expect(shiftMinute(0, -1)).toBe(59)
  })
})
