import { describe, expect, it } from 'vitest'
import {
  FEATURE_KEYS,
  evaluateFeatureAccess,
  isGaMemberUser,
  resolveUserAccessTier,
} from './featureEntitlementPolicy'

const tiers = {
  FREE_GENERAL: { hasActivePaidAccess: false, isGaMember: false },
  ACTIVE_GENERAL: { hasActivePaidAccess: true, isGaMember: false },
  FREE_GA: { hasActivePaidAccess: false, isGaMember: true },
  ACTIVE_GA: { hasActivePaidAccess: true, isGaMember: true },
}

describe('featureEntitlementPolicy matrix', () => {
  it('resolves user access tiers', () => {
    expect(resolveUserAccessTier(tiers.FREE_GENERAL)).toBe('FREE_GENERAL')
    expect(resolveUserAccessTier(tiers.ACTIVE_GENERAL)).toBe('ACTIVE_GENERAL')
    expect(resolveUserAccessTier(tiers.FREE_GA)).toBe('FREE_GA')
    expect(resolveUserAccessTier(tiers.ACTIVE_GA)).toBe('ACTIVE_GA')
  })

  it('FREE_GENERAL — free features allowed, paid blocked', () => {
    for (const feature of [
      FEATURE_KEYS.TODOS,
      FEATURE_KEYS.MEMOS,
      FEATURE_KEYS.SHARED_NEWSLETTER,
      FEATURE_KEYS.INSURER_CONTACTS,
      FEATURE_KEYS.INSURER_SITES,
    ]) {
      expect(evaluateFeatureAccess(feature, tiers.FREE_GENERAL).allowed).toBe(true)
    }
    for (const feature of [FEATURE_KEYS.CUSTOMERS, FEATURE_KEYS.TEAM, FEATURE_KEYS.STORAGE]) {
      const verdict = evaluateFeatureAccess(feature, tiers.FREE_GENERAL)
      expect(verdict.allowed).toBe(false)
      expect(verdict.reason).toBe('paid_required')
      expect(verdict.badges).toEqual(['유료'])
    }
  })

  it('ACTIVE_GENERAL — paid CRM allowed, GA-only blocked', () => {
    expect(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.ACTIVE_GENERAL).allowed).toBe(true)
    expect(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.ACTIVE_GENERAL).badges).toEqual([])
    expect(evaluateFeatureAccess(FEATURE_KEYS.TEAM, tiers.ACTIVE_GENERAL).allowed).toBe(true)
    expect(evaluateFeatureAccess(FEATURE_KEYS.TEAM, tiers.ACTIVE_GENERAL).badges).toEqual([])
    expect(evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.ACTIVE_GENERAL).allowed).toBe(
      false,
    )
    expect(evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.ACTIVE_GENERAL).badges).toEqual([
      'GA 전용',
    ])
    expect(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.ACTIVE_GENERAL).allowed).toBe(false)
    expect(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.ACTIVE_GENERAL).badges).toEqual([
      'GA 전용',
    ])
  })

  it('FREE_GA — GA newsletters allowed without payment', () => {
    expect(evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.FREE_GA).allowed).toBe(true)
    expect(evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.FREE_GA).badges).toEqual([])
    expect(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.FREE_GA).allowed).toBe(false)
    expect(evaluateFeatureAccess(FEATURE_KEYS.CUSTOMERS, tiers.FREE_GA).badges).toEqual(['유료'])
    expect(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.FREE_GA).reason).toBe('paid_required')
    expect(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.FREE_GA).badges).toEqual(['유료'])
  })

  it('ACTIVE_GA — paid + GA features allowed', () => {
    expect(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.ACTIVE_GA).allowed).toBe(true)
    expect(evaluateFeatureAccess(FEATURE_KEYS.APPLICATION, tiers.ACTIVE_GA).badges).toEqual([])
    expect(evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.ACTIVE_GA).allowed).toBe(true)
    expect(evaluateFeatureAccess(FEATURE_KEYS.INSURER_NEWSLETTER, tiers.ACTIVE_GA).badges).toEqual([])
  })

  it('detects GA membership excluding GENERAL', () => {
    expect(isGaMemberUser({ gaCode: 'GENERAL', gaName: '공용' })).toBe(false)
    expect(isGaMemberUser({ gaCode: 'YJASSET', gaName: '영진에셋' })).toBe(true)
  })
})
