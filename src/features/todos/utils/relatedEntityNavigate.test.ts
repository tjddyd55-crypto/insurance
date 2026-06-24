import { describe, expect, it } from 'vitest'
import { buildRelatedEntityHref } from './relatedEntityNavigate'

describe('buildRelatedEntityHref', () => {
  it('opens consultation history for customer todos on PC', () => {
    expect(buildRelatedEntityHref('customer', '42')).toBe('/customers/42/consultations?customerId=42')
    expect(buildRelatedEntityHref('customer', '42', { isMobile: false })).toBe(
      '/customers/42/consultations?customerId=42',
    )
  })

  it('uses mobile list selection path without forcing memos or consultations', () => {
    expect(buildRelatedEntityHref('customer', '42', { isMobile: true })).toBe(
      '/customers?customerId=42',
    )
    expect(buildRelatedEntityHref('customer', '7', { isMobile: true })).not.toContain('/memos')
    expect(buildRelatedEntityHref('customer', '7', { isMobile: true })).not.toContain(
      '/consultations',
    )
  })

  it('returns null for invalid customer id', () => {
    expect(buildRelatedEntityHref('customer', '0')).toBeNull()
    expect(buildRelatedEntityHref('customer', '')).toBeNull()
  })
})
