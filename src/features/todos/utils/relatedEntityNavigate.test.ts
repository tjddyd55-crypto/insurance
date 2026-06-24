import { describe, expect, it } from 'vitest'
import { buildRelatedEntityHref } from './relatedEntityNavigate'

describe('buildRelatedEntityHref', () => {
  it('opens consultation history for customer todos', () => {
    expect(buildRelatedEntityHref('customer', '42')).toBe('/customers/42/consultations')
  })

  it('still opens memos only when callers pass an explicit memos path', () => {
    expect(buildRelatedEntityHref('customer', '7')).not.toContain('/memos')
  })

  it('returns null for invalid customer id', () => {
    expect(buildRelatedEntityHref('customer', '0')).toBeNull()
    expect(buildRelatedEntityHref('customer', '')).toBeNull()
  })
})
