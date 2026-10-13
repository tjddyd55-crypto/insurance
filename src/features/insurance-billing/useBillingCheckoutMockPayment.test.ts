import { describe, expect, it } from 'vitest'

/**
 * Checkout CTA gate — mock provider must not require Toss clientKey.
 */
function canSubmitCheckoutPayment(input: {
  provider?: string
  enabled?: boolean
  mockPaymentAllowed?: boolean
  clientKey?: string | null
}) {
  const canUseToss = input.provider === 'toss' && Boolean(input.enabled) && Boolean(input.clientKey)
  const canUseMockPayment = input.provider === 'mock' && Boolean(input.mockPaymentAllowed ?? input.enabled)
  return canUseToss || canUseMockPayment
}

describe('checkout payment submission gates', () => {
  it('allows mock checkout without toss client key', () => {
    expect(
      canSubmitCheckoutPayment({
        provider: 'mock',
        enabled: true,
        mockPaymentAllowed: true,
        clientKey: null,
      }),
    ).toBe(true)
  })

  it('blocks mock checkout when mock payment not allowed', () => {
    expect(
      canSubmitCheckoutPayment({
        provider: 'mock',
        enabled: false,
        mockPaymentAllowed: false,
        clientKey: null,
      }),
    ).toBe(false)
  })
})
