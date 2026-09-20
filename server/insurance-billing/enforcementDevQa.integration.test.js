import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateApiFeatureAccess } from '../entitlements/featureApiPolicy.js'

/**
 * DEV enforcement ON 시뮬레이션 — billing middleware가 사용하는 동일 API policy.
 * INSURANCE_BILLING_ENFORCE_ACCESS=true 환경에서도 free prefix는 통과해야 한다.
 */
describe('DEV enforcement ON simulation', () => {
  const FREE_GENERAL = { hasActivePaidAccess: false, isGaMember: false }
  const ACTIVE_GENERAL = { hasActivePaidAccess: true, isGaMember: false }
  const FREE_GA = { hasActivePaidAccess: false, isGaMember: true }
  const ACTIVE_GA = { hasActivePaidAccess: true, isGaMember: true }

  it('FREE_GENERAL keeps free APIs while blocking paid APIs', () => {
    assert.equal(evaluateApiFeatureAccess('/api/memos', FREE_GENERAL).allowed, true)
    assert.equal(evaluateApiFeatureAccess('/api/insurance/contacts', FREE_GENERAL).allowed, true)
    assert.equal(evaluateApiFeatureAccess('/api/customers', FREE_GENERAL).allowed, false)
    assert.equal(evaluateApiFeatureAccess('/api/team/files', FREE_GENERAL).allowed, false)
  })

  it('ACTIVE_GENERAL opens paid APIs but not GA-only APIs', () => {
    assert.equal(evaluateApiFeatureAccess('/api/customers', ACTIVE_GENERAL).allowed, true)
    assert.equal(evaluateApiFeatureAccess('/api/team/files', ACTIVE_GENERAL).allowed, true)
    assert.equal(evaluateApiFeatureAccess('/api/forms', ACTIVE_GENERAL).allowed, false)
  })

  it('FREE_GA opens GA channel without payment', () => {
    assert.equal(evaluateApiFeatureAccess('/api/insurer-news/channel/insurer', FREE_GA).allowed, true)
    assert.equal(evaluateApiFeatureAccess('/api/customers', FREE_GA).allowed, false)
    assert.equal(evaluateApiFeatureAccess('/api/application', FREE_GA).allowed, false)
  })

  it('ACTIVE_GA opens all gated APIs', () => {
    assert.equal(evaluateApiFeatureAccess('/api/customers', ACTIVE_GA).allowed, true)
    assert.equal(evaluateApiFeatureAccess('/api/forms', ACTIVE_GA).allowed, true)
    assert.equal(evaluateApiFeatureAccess('/api/insurer-news/channel/insurer', ACTIVE_GA).allowed, true)
  })
})
