import { describe, expect, it } from 'vitest'
import {
  formatBusinessNumberDisplay,
  isCustomerBusinessInfoFormEmpty,
  normalizeCustomerBusinessInfo,
} from './customerBusinessInfo'

describe('customerBusinessInfo', () => {
  it('returns null for empty business info', () => {
    expect(normalizeCustomerBusinessInfo(null)).toBeNull()
    expect(normalizeCustomerBusinessInfo({ representativeName: '' })).toBeNull()
  })

  it('formats business number for display', () => {
    expect(formatBusinessNumberDisplay('1234567890')).toBe('123-45-67890')
  })

  it('detects empty form state', () => {
    expect(
      isCustomerBusinessInfoFormEmpty({
        representativeName: '',
        businessNumber: '',
        businessAddress: '',
        memo: '',
      }),
    ).toBe(true)
  })
})
