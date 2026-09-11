import { describe, expect, it } from 'vitest'
import { CUSTOMER_SECTION_THEMES } from './customerSectionTheme'

describe('customerSectionTheme', () => {
  it('exposes Figma-approved accent colors for core sections', () => {
    expect(CUSTOMER_SECTION_THEMES.basic.accent).toBe('#334155')
    expect(CUSTOMER_SECTION_THEMES.car.accent).toBe('#2563EB')
    expect(CUSTOMER_SECTION_THEMES.linked.accent).toBe('#14B8A6')
    expect(CUSTOMER_SECTION_THEMES.business.accent).toBe('#16A34A')
    expect(CUSTOMER_SECTION_THEMES.fire.accent).toBe('#D97706')
    expect(CUSTOMER_SECTION_THEMES.anniversary.accent).toBe('#7C3AED')
  })
})
