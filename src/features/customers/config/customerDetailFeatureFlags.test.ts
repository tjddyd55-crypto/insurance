import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_DETAIL_FEATURE_FLAGS,
  canShowCustomerDetailElectronicSignature,
} from './customerDetailFeatureFlags'

describe('customerDetailFeatureFlags', () => {
  it('hides electronic signature in customer detail for USER when flag is off', () => {
    expect(CUSTOMER_DETAIL_FEATURE_FLAGS.electronicSignature).toBe(false)
    expect(canShowCustomerDetailElectronicSignature('USER')).toBe(false)
    expect(canShowCustomerDetailElectronicSignature('GA_STAFF')).toBe(false)
    expect(canShowCustomerDetailElectronicSignature('GA_ADMIN')).toBe(false)
  })
})
