import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateApiFeatureAccess } from './featureApiPolicy.js'
import { evaluateFeatureAccess, FEATURE_KEYS } from './featureEntitlementPolicy.js'

const tiers = {
  FREE_GENERAL: { hasActivePaidAccess: false, isGaMember: false },
  ACTIVE_GENERAL: { hasActivePaidAccess: true, isGaMember: false },
  FREE_GA: { hasActivePaidAccess: false, isGaMember: true },
  ACTIVE_GA: { hasActivePaidAccess: true, isGaMember: true },
}

function expectApi(path, tier, allowed, reason = null) {
  const verdict = evaluateApiFeatureAccess(path, tiers[tier])
  assert.equal(verdict.allowed, allowed, `${tier} ${path}`)
  if (!allowed) {
    assert.equal(verdict.reason, reason, `${tier} ${path} reason`)
  }
}

describe('4-tier API entitlement integration', () => {
  it('FREE_GENERAL — free APIs open, paid blocked', () => {
    expectApi('/api/todos', 'FREE_GENERAL', true)
    expectApi('/api/memos', 'FREE_GENERAL', true)
    expectApi('/api/insurance/contacts', 'FREE_GENERAL', true)
    expectApi('/api/insurer-news/boards', 'FREE_GENERAL', true)
    expectApi('/api/customers', 'FREE_GENERAL', false, 'paid_required')
    expectApi('/api/team/members', 'FREE_GENERAL', false, 'paid_required')
    expectApi('/api/storage/files', 'FREE_GENERAL', false, 'paid_required')
    expectApi('/api/forms', 'FREE_GENERAL', false, 'paid_required')
    expectApi('/api/insurer-news/channel/insurer', 'FREE_GENERAL', false, 'ga_required')
  })

  it('ACTIVE_GENERAL — paid CRM open, GA-only blocked', () => {
    expectApi('/api/customers', 'ACTIVE_GENERAL', true)
    expectApi('/api/team/members', 'ACTIVE_GENERAL', true)
    expectApi('/api/storage/files', 'ACTIVE_GENERAL', true)
    expectApi('/api/forms', 'ACTIVE_GENERAL', false, 'ga_required')
    expectApi('/api/insurer-news/channel/insurer', 'ACTIVE_GENERAL', false, 'ga_required')
  })

  it('FREE_GA — GA newsletter open without payment, paid CRM blocked', () => {
    expectApi('/api/insurer-news/channel/insurer', 'FREE_GA', true)
    expectApi('/api/customers', 'FREE_GA', false, 'paid_required')
    expectApi('/api/team/members', 'FREE_GA', false, 'paid_required')
    expectApi('/api/forms', 'FREE_GA', false, 'paid_required')
  })

  it('ACTIVE_GA — paid + GA features open', () => {
    expectApi('/api/customers', 'ACTIVE_GA', true)
    expectApi('/api/team/members', 'ACTIVE_GA', true)
    expectApi('/api/forms', 'ACTIVE_GA', true)
    expectApi('/api/insurer-news/channel/insurer', 'ACTIVE_GA', true)
  })
})

describe('4-tier feature badge expectations', () => {
  it('FREE_GENERAL badges for blocked features', () => {
    assert.deepEqual(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.FREE_GENERAL).badges, ['유료'])
    assert.deepEqual(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.FREE_GENERAL).badges, [
      '유료',
      'GA 전용',
    ])
    assert.deepEqual(
      evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.FREE_GENERAL).badges,
      ['GA 전용'],
    )
  })

  it('ACTIVE_GENERAL does not unlock GA-only features', () => {
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.ACTIVE_GENERAL).allowed, false)
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.ACTIVE_GENERAL).allowed, false)
    assert.equal(evaluateFeatureAccess(FEATURE_KEYS.TEAM, tiers.ACTIVE_GENERAL).allowed, true)
  })
})
