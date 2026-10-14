import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CheckoutCouponSection } from './BillingCheckoutSections'
import type { BillingCheckoutViewProps } from './billingCheckoutViewProps'

function render(overrides: Partial<BillingCheckoutViewProps>) {
  const props = {
    promoAllowed: true,
    promoCode: '',
    onPromoCodeChange: () => {},
    onApplyPromo: () => {},
    onClearPromo: () => {},
    promoMessage: '',
    quote: null,
    submitting: false,
    ...overrides,
  } as unknown as BillingCheckoutViewProps
  return renderToStaticMarkup(<CheckoutCouponSection props={props} />)
}

describe('CheckoutCouponSection UI SSOT', () => {
  it('uses shared FormInput + secondary Button with label', () => {
    const html = render({ promoCode: 'ABC' })
    expect(html).toContain('field__label">쿠폰 코드')
    expect(html).toContain('form-input')
    expect(html).toMatch(/class="button button--secondary"[^>]*>쿠폰 적용</)
    expect(html).not.toContain('insurance-billing-cta')
  })

  it('disables apply when empty', () => {
    expect(render({ promoCode: '' })).toMatch(/disabled=""[^>]*>쿠폰 적용</)
  })
})
