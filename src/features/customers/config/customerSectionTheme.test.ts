import { describe, expect, it } from 'vitest'
import { customerDetailSectionTheme } from './customerSectionTheme'

describe('customerSectionTheme', () => {
  it('maps pc core section ids to native-compatible accent colors', () => {
    expect(customerDetailSectionTheme('basic').accent).toBe('#334155')
    expect(customerDetailSectionTheme('vehicle').accent).toBe('#2563EB')
    expect(customerDetailSectionTheme('linked').accent).toBe('#14B8A6')
    expect(customerDetailSectionTheme('fireInsurance').accent).toBe('#D97706')
    expect(customerDetailSectionTheme('business').accent).toBe('#16A34A')
    expect(customerDetailSectionTheme('alertDates').accent).toBe('#7C3AED')
  })
})
