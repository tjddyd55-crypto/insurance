import { describe, expect, it } from 'vitest'
import { formatPhone, formatPhoneNumber, getPhoneClipboardText } from './phone'

describe('phone formatter SSOT', () => {
  it('formats insurer service numbers (8 digits)', () => {
    expect(formatPhoneNumber('15882111')).toBe('1588-2111')
    expect(formatPhone('15882111')).toBe('1588-2111')
    expect(getPhoneClipboardText('15882111')).toBe('1588-2111')
  })

  it('formats 1577-xxxx style numbers', () => {
    expect(getPhoneClipboardText('15771234')).toBe('1577-1234')
  })

  it('formats landline and mobile', () => {
    expect(getPhoneClipboardText('0212345678')).toBe('02-1234-5678')
    expect(getPhoneClipboardText('0311234567')).toBe('031-123-4567')
    expect(getPhoneClipboardText('01012345678')).toBe('010-1234-5678')
  })

  it('keeps already formatted values', () => {
    expect(getPhoneClipboardText('1588-2111')).toBe('1588-2111')
    expect(getPhoneClipboardText('010-2222-1382')).toBe('010-2222-1382')
  })

  it('matches display formatter for clipboard helper', () => {
    const samples = ['15882111', '15771234', '0212345678', '01012345678', '1588-2111']
    for (const sample of samples) {
      expect(getPhoneClipboardText(sample)).toBe(formatPhone(sample))
    }
  })
})
