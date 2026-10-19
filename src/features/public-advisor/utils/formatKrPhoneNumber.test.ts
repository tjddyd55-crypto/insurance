import { describe, expect, it } from 'vitest'

import {
  formatKrPhoneInputLive,
  formatKrPhoneNumberForDisplay,
  normalizePhoneDigits,
} from './formatKrPhoneNumber'

describe('formatKrPhoneNumberForDisplay', () => {
  it('formats mobile', () => {
    expect(formatKrPhoneNumberForDisplay('01022221382')).toBe('010-2222-1382')
  })

  it('formats 0502-0508 personal numbers as 4-3-4 or 4-4-4', () => {
    expect(formatKrPhoneNumberForDisplay('05044789523')).toBe('0504-478-9523')
    expect(formatKrPhoneNumberForDisplay('05044787852')).toBe('0504-478-7852')
    expect(formatKrPhoneNumberForDisplay('05021234567')).toBe('0502-123-4567')
    expect(formatKrPhoneNumberForDisplay('05081234567')).toBe('0508-123-4567')
    expect(formatKrPhoneNumberForDisplay('050512345678')).toBe('0505-1234-5678')
    expect(formatKrPhoneNumberForDisplay('0504-478-9523')).toBe('0504-478-9523')
  })

  it('keeps non-personal 050 on the 3-digit prefix', () => {
    expect(formatKrPhoneNumberForDisplay('05011234567')).toBe('050-1123-4567')
  })

  it('formats seoul, area, 070, and representative numbers', () => {
    expect(formatKrPhoneNumberForDisplay('0212345678')).toBe('02-1234-5678')
    expect(formatKrPhoneNumberForDisplay('021234567')).toBe('02-123-4567')
    expect(formatKrPhoneNumberForDisplay('0311234567')).toBe('031-123-4567')
    expect(formatKrPhoneNumberForDisplay('03112345678')).toBe('031-1234-5678')
    expect(formatKrPhoneNumberForDisplay('07012345678')).toBe('070-1234-5678')
    expect(formatKrPhoneNumberForDisplay('15881234')).toBe('1588-1234')
  })
})

describe('formatKrPhoneInputLive', () => {
  it('strips and formats', () => {
    expect(formatKrPhoneInputLive('010-2222-1382')).toBe('010-2222-1382')
  })

  it('formats 050X while typing and after completion', () => {
    expect(formatKrPhoneInputLive('0504')).toBe('0504')
    expect(formatKrPhoneInputLive('05044789523')).toBe('0504-478-9523')
    expect(formatKrPhoneInputLive('050512345678')).toBe('0505-1234-5678')
    expect(formatKrPhoneInputLive('01022221382')).toBe('010-2222-1382')
    expect(formatKrPhoneInputLive('0212345678')).toBe('02-1234-5678')
    expect(formatKrPhoneInputLive('021234567')).toBe('02-123-4567')
    expect(formatKrPhoneInputLive('0311234567')).toBe('031-123-4567')
    expect(formatKrPhoneInputLive('03112345678')).toBe('031-1234-5678')
    expect(formatKrPhoneInputLive('07012345678')).toBe('070-1234-5678')
    expect(formatKrPhoneInputLive('15881234')).toBe('1588-1234')
  })
})

describe('normalizePhoneDigits', () => {
  it('removes non-digits', () => {
    expect(normalizePhoneDigits('010-2222-1382')).toBe('01022221382')
    expect(normalizePhoneDigits('0504-478-9523')).toBe('05044789523')
  })
})
