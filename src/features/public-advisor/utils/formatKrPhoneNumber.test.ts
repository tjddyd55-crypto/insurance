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

  it('formats 050', () => {
    expect(formatKrPhoneNumberForDisplay('05044787852')).toBe('050-4478-7852')
  })
})

describe('formatKrPhoneInputLive', () => {
  it('strips and formats', () => {
    expect(formatKrPhoneInputLive('010-2222-1382')).toBe('010-2222-1382')
  })
})

describe('normalizePhoneDigits', () => {
  it('removes non-digits', () => {
    expect(normalizePhoneDigits('010-2222-1382')).toBe('01022221382')
  })
})
