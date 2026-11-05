import { describe, expect, it } from 'vitest'
import { formatInsurerCustomerResidentBesideName } from './formatInsurerCustomerResidentNumber'

/** 입력 포맷터 placeholder와 같은 가공 번호. 실존 주민번호가 아니다. */
const FICTIONAL_RRN = '9001011234567'

describe('formatInsurerCustomerResidentBesideName', () => {
  it('uses the existing customer resident-number hyphen format', () => {
    expect(formatInsurerCustomerResidentBesideName(FICTIONAL_RRN)).toBe('900101-1234567')
    expect(formatInsurerCustomerResidentBesideName('900101-1234567')).toBe('900101-1234567')
  })

  it('shows the customer-detail empty mark when the value is missing', () => {
    expect(formatInsurerCustomerResidentBesideName('')).toBe('—')
    expect(formatInsurerCustomerResidentBesideName('   ')).toBe('—')
    expect(formatInsurerCustomerResidentBesideName(null)).toBe('—')
    expect(formatInsurerCustomerResidentBesideName(undefined)).toBe('—')
  })

  it('does not substitute a phone number when the resident number is absent', () => {
    expect(formatInsurerCustomerResidentBesideName('')).not.toContain('010')
    expect(formatInsurerCustomerResidentBesideName(null)).toBe('—')
  })
})
