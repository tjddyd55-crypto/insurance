import { describe, expect, it } from 'vitest'
import {
  formatKoreanMobilePhone,
  formatKoreanResidentNumber,
  normalizeDigits,
  stripPhoneFormatting,
  stripResidentNumberFormatting,
} from './inputFormatters'

describe('normalizeDigits', () => {
  it('strips non-digits and respects maxLength', () => {
    expect(normalizeDigits('010-1234-5678')).toBe('01012345678')
    expect(normalizeDigits('010.1234.5678abc', 11)).toBe('01012345678')
    expect(normalizeDigits('01012345678999', 11)).toBe('01012345678')
  })
})

describe('formatKoreanMobilePhone', () => {
  it('formats 11-digit mobile as 3-4-4', () => {
    expect(formatKoreanMobilePhone('01012345678')).toBe('010-1234-5678')
  })

  it('is idempotent for already formatted values', () => {
    expect(formatKoreanMobilePhone('010-1234-5678')).toBe('010-1234-5678')
  })

  it('normalizes spaces and dots', () => {
    expect(formatKoreanMobilePhone('010 1234 5678')).toBe('010-1234-5678')
    expect(formatKoreanMobilePhone('010.1234.5678')).toBe('010-1234-5678')
  })

  it('formats 10-digit mobile as 3-3-4', () => {
    expect(formatKoreanMobilePhone('0111234567')).toBe('011-123-4567')
  })

  it('builds progressive input', () => {
    expect(formatKoreanMobilePhone('0')).toBe('0')
    expect(formatKoreanMobilePhone('01')).toBe('01')
    expect(formatKoreanMobilePhone('010')).toBe('010')
    expect(formatKoreanMobilePhone('0101')).toBe('010-1')
    expect(formatKoreanMobilePhone('01012')).toBe('010-12')
    expect(formatKoreanMobilePhone('010123')).toBe('010-123')
    expect(formatKoreanMobilePhone('0101234')).toBe('010-1234')
    expect(formatKoreanMobilePhone('01012345')).toBe('010-1234-5')
    expect(formatKoreanMobilePhone('01012345678')).toBe('010-1234-5678')
  })

  it('strips non-digits and truncates over 11', () => {
    expect(formatKoreanMobilePhone('abc010-1234-5678xyz999')).toBe('010-1234-5678')
  })
})

describe('formatKoreanResidentNumber', () => {
  it('formats 13 digits with hyphen after 6', () => {
    expect(formatKoreanResidentNumber('9001011234567')).toBe('900101-1234567')
  })

  it('is idempotent for already formatted values', () => {
    expect(formatKoreanResidentNumber('900101-1234567')).toBe('900101-1234567')
  })

  it('normalizes spaces', () => {
    expect(formatKoreanResidentNumber('900101 1234567')).toBe('900101-1234567')
  })

  it('has no hyphen for 6 digits or fewer', () => {
    expect(formatKoreanResidentNumber('9')).toBe('9')
    expect(formatKoreanResidentNumber('90')).toBe('90')
    expect(formatKoreanResidentNumber('900101')).toBe('900101')
  })

  it('builds progressive input after 6 digits', () => {
    expect(formatKoreanResidentNumber('9001011')).toBe('900101-1')
    expect(formatKoreanResidentNumber('90010112')).toBe('900101-12')
    expect(formatKoreanResidentNumber('9001011234567')).toBe('900101-1234567')
  })

  it('strips non-digits and truncates over 13', () => {
    expect(formatKoreanResidentNumber('900101-1234567extra')).toBe('900101-1234567')
  })
})

describe('strip helpers', () => {
  it('returns digits only', () => {
    expect(stripPhoneFormatting('010-1234-5678')).toBe('01012345678')
    expect(stripResidentNumberFormatting('900101-1234567')).toBe('9001011234567')
  })
})
