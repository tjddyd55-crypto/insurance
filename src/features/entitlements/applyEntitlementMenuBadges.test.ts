import { describe, expect, it } from 'vitest'
import { applyEntitlementMenuBadges } from './applyEntitlementMenuBadges'
import { FEATURE_KEYS } from './featureEntitlementPolicy'

const FREE_GENERAL = { hasActivePaidAccess: false, isGaMember: false }

describe('applyEntitlementMenuBadges', () => {
  it('keeps menu paths visible and adds paid badge for blocked features', () => {
    const entries = applyEntitlementMenuBadges(
      [{ type: 'link', label: '고객관리', path: '/customers' }],
      FREE_GENERAL,
    )
    expect(entries[0]?.path).toBe('/customers')
    expect(entries[0]?.badge).toBe('유료')
    expect(entries[0]?.entitlementBlocked).toBe(true)
    expect(entries[0]?.featureKey).toBe(FEATURE_KEYS.CUSTOMERS)
  })

  it('does not badge free features', () => {
    const entries = applyEntitlementMenuBadges(
      [{ type: 'link', label: '할 일', path: '/todos' }],
      FREE_GENERAL,
    )
    expect(entries[0]?.badge).toBeUndefined()
    expect(entries[0]?.entitlementBlocked).toBeUndefined()
  })

  it('uses board scope for dynamic newsletter boards', () => {
    const entries = applyEntitlementMenuBadges(
      [{ type: 'link', label: '공용안내', path: '/portal/boards/shared-news' }],
      FREE_GENERAL,
      [{ path: '/portal/boards/shared-news', boardScope: 'global' }],
    )
    expect(entries[0]?.badge).toBeUndefined()

    const gaEntries = applyEntitlementMenuBadges(
      [{ type: 'link', label: '내부공지', path: '/portal/boards/internal-news' }],
      FREE_GENERAL,
      [{ path: '/portal/boards/internal-news', boardScope: 'ga' }],
    )
    expect(gaEntries[0]?.badge).toBe('GA 전용')
    expect(gaEntries[0]?.entitlementReason).toBe('ga_required')
  })
})
