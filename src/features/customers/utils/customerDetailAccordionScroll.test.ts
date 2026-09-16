import { describe, expect, it } from 'vitest'
import { computeAccordionScrollCompensation } from './customerDetailAccordionScroll'

describe('customerDetailAccordionScroll', () => {
  it('keeps target header viewport position after accordion layout shift', () => {
    expect(
      computeAccordionScrollCompensation({
        beforeTop: 180,
        afterTop: 120,
      }),
    ).toBe(-60)
  })

  it('returns zero when layout did not move the target', () => {
    expect(
      computeAccordionScrollCompensation({
        beforeTop: 200,
        afterTop: 200,
      }),
    ).toBe(0)
  })
})
