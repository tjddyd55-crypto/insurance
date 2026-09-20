import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FEATURE_KEYS,
  evaluateFeatureAccess,
  isGaMemberUser,
  resolveUserAccessTier,
} from './featureEntitlementPolicy.js'

const tiers = {
  FREE_GENERAL: { hasActivePaidAccess: false, isGaMember: false },
  ACTIVE_GENERAL: { hasActivePaidAccess: true, isGaMember: false },
  FREE_GA: { hasActivePaidAccess: false, isGaMember: true },
  ACTIVE_GA: { hasActivePaidAccess: true, isGaMember: true },
}

describe('featureEntitlementPolicy matrix', () => {
  it('resolves user access tiers', () => {
    assert.equal(resolveUserAccessTier(tiers.FREE_GENERAL), 'FREE_GENERAL')
    assert.equal(resolveUserAccessTier(tiers.ACTIVE_GENERAL), 'ACTIVE_GENERAL')
    assert.equal(resolveUserAccessTier(tiers.FREE_GA), 'FREE_GA')
    assert.equal(resolveUserAccessTier(tiers.ACTIVE_GA), 'ACTIVE_GA')
  })

  it('FREE_GENERAL — free features allowed, paid blocked', () => {
    for (const feature of [
      FEATURE_KEYS.TODOS,
      FEATURE_KEYS.MEMOS,
      FEATURE_KEYS.SHARED_NEWSLETTER,
      FEATURE_KEYS.INSURER_CONTACTS,
      FEATURE_KEYS.INSURER_SITES,
    ]) {
      assert.equal(evaluateFeatureAccess(feature, tiers.FREE_GENERAL).allowed, true)
    }
    for (const feature of [FEATURE_KEYS.CUSTOMERS, FEATURE_KEYS.TEAM, FEATURE_KEYS.STORAGE]) {
      const verdict = evaluateFeatureAccess(feature, tiers.FREE_GENERAL)
      assert.equal(verdict.allowed, false)
      assert.equal(verdict.reason, 'paid_required')
      assert.deepEqual(verdict.badges, ['유료'])
    }
    const application = evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.FREE_GENERAL)
    assert.equal(application.allowed, false)
    assert.equal(application.reason, 'paid_required')
  })

  it('ACTIVE_GENERAL — paid CRM allowed, GA-only blocked', () => {
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.ACTIVE_GENERAL).allowed, true)
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.TEAM, tiers.ACTIVE_GENERAL).allowed, true)
    assert.equal(
      evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.ACTIVE_GENERAL).allowed,
      false,
    )
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.ACTIVE_GENERAL).allowed, false)
  })

  it('FREE_GA — free allowed, paid CRM blocked, GA-only still blocked without payment for application', () => {
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.TODOS, tiers.FREE_GA).allowed, true)
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.FREE_GA).allowed, false)
    assert.equal(
      evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.FREE_GA).allowed,
      true,
    )
    const application = evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.FREE_GA)
    assert.equal(application.allowed, false)
    assert.equal(application.reason, 'paid_required')
  })

  it('ACTIVE_GA — paid + GA features allowed', () => {
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.ACTIVE_GA).allowed, true)
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.TEAM, tiers.ACTIVE_GA).allowed, true)
    assert.equal(
      evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.ACTIVE_GA).allowed,
      true,
    )
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.ACTIVE_GA).allowed, true)
  })

  it('detects GA membership excluding GENERAL', () => {
    assert.equal(isGaMemberUser({ gaCode: 'GENERAL', gaName: '공용' }), false)
    assert.equal(isGaMemberUser({ gaCode: 'YJASSET', gaName: '영진에셋' }), true)
  })
})
