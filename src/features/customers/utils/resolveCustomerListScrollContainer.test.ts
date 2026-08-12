import { describe, expect, it } from 'vitest'
import { computeCustomerCardScrollTop } from './resolveCustomerListScrollContainer'

describe('computeCustomerCardScrollTop', () => {
  it('computes container-relative target from current scrollTop and rects', () => {
    expect(
      computeCustomerCardScrollTop({
        containerScrollTop: 400,
        containerTop: 100,
        cardTop: 250,
      }),
    ).toBe(550)
  })

  it('subtracts sticky height and padding', () => {
    expect(
      computeCustomerCardScrollTop({
        containerScrollTop: 400,
        containerTop: 100,
        cardTop: 250,
        stickyHeight: 48,
        topPadding: 8,
      }),
    ).toBe(494)
  })

  it('never returns negative scrollTop', () => {
    expect(
      computeCustomerCardScrollTop({
        containerScrollTop: 10,
        containerTop: 200,
        cardTop: 100,
        stickyHeight: 50,
      }),
    ).toBe(0)
  })
})
