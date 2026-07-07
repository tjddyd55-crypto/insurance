import { describe, expect, it } from 'vitest'
import { parseKoreanTime } from './parseKoreanTime'

describe('parseKoreanTime', () => {
  it('maps noon and midnight correctly', () => {
    expect(parseKoreanTime('오전 12:00')).toBe('00:00')
    expect(parseKoreanTime('오후 12:00')).toBe('12:00')
  })

  it('maps morning and afternoon hours', () => {
    expect(parseKoreanTime('오전 9:30')).toBe('09:30')
    expect(parseKoreanTime('오후 9:30')).toBe('21:30')
    expect(parseKoreanTime('오전 1:00')).toBe('01:00')
    expect(parseKoreanTime('오후 1:00')).toBe('13:00')
  })

  it('returns null for invalid labels', () => {
    expect(parseKoreanTime('09:00')).toBeNull()
    expect(parseKoreanTime('오전 13:00')).toBeNull()
  })
})
