import { describe, expect, it } from 'vitest'
import {
  evaluateFeatureAccess,
  FEATURE_KEYS,
} from './featureEntitlementPolicy'
import { resolveFeatureKeyFromPath } from './featureRoutePolicy'

const tiers = {
  FREE_GENERAL: { hasActivePaidAccess: false, isGaMember: false },
  ACTIVE_GENERAL: { hasActivePaidAccess: true, isGaMember: false },
  FREE_GA: { hasActivePaidAccess: false, isGaMember: true },
  ACTIVE_GA: { hasActivePaidAccess: true, isGaMember: true },
}

function routeAllowed(path: string, tier: keyof typeof tiers) {
  const featureKey = resolveFeatureKeyFromPath(path)
  if (!featureKey) return true
  return evaluateFeatureAccess(featureKey, tiers[tier]).allowed
}

describe('4-tier web route entitlement integration', () => {
  it('FREE_GENERAL — free routes open, paid/GA blocked', () => {
    expect(routeAllowed('/todos', 'FREE_GENERAL')).toBe(true)
    expect(routeAllowed('/memo', 'FREE_GENERAL')).toBe(true)
    expect(routeAllowed('/insurance/contacts', 'FREE_GENERAL')).toBe(true)
    expect(routeAllowed('/insurance/insurer-sites', 'FREE_GENERAL')).toBe(true)
    expect(routeAllowed('/portal/boards/shared-news', 'FREE_GENERAL')).toBe(true)
    expect(routeAllowed('/customers', 'FREE_GENERAL')).toBe(false)
    expect(routeAllowed('/premium-payments', 'FREE_GENERAL')).toBe(false)
    expect(routeAllowed('/claim-requests', 'FREE_GENERAL')).toBe(false)
    expect(routeAllowed('/team/files', 'FREE_GENERAL')).toBe(false)
    expect(routeAllowed('/storage', 'FREE_GENERAL')).toBe(false)
    expect(routeAllowed('/application', 'FREE_GENERAL')).toBe(false)
    expect(routeAllowed('/portal/newsletters', 'FREE_GENERAL')).toBe(false)
  })

  it('ACTIVE_GENERAL — paid routes open, GA-only blocked', () => {
    expect(routeAllowed('/customers', 'ACTIVE_GENERAL')).toBe(true)
    expect(routeAllowed('/team/manage', 'ACTIVE_GENERAL')).toBe(true)
    expect(routeAllowed('/storage', 'ACTIVE_GENERAL')).toBe(true)
    expect(routeAllowed('/portal/newsletters', 'ACTIVE_GENERAL')).toBe(false)
    expect(routeAllowed('/application', 'ACTIVE_GENERAL')).toBe(false)
  })

  it('FREE_GA — GA newsletters without payment, paid CRM blocked', () => {
    expect(routeAllowed('/portal/newsletters', 'FREE_GA')).toBe(true)
    expect(routeAllowed('/customers', 'FREE_GA')).toBe(false)
    expect(routeAllowed('/team/files', 'FREE_GA')).toBe(false)
    expect(routeAllowed('/application', 'FREE_GA')).toBe(false)
  })

  it('ACTIVE_GA — all gated features open', () => {
    expect(routeAllowed('/customers', 'ACTIVE_GA')).toBe(true)
    expect(routeAllowed('/team/files', 'ACTIVE_GA')).toBe(true)
    expect(routeAllowed('/application', 'ACTIVE_GA')).toBe(true)
    expect(routeAllowed('/portal/newsletters', 'ACTIVE_GA')).toBe(true)
  })
})
