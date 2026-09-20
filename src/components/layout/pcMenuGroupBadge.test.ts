import { describe, expect, it } from 'vitest'
import { applyEntitlementMenuBadges } from '../../features/entitlements/applyEntitlementMenuBadges'
import { resolvePcMenuGroupBadgeLabels } from './pcMenuGroupBadge'

const FREE_GENERAL = { hasActivePaidAccess: false, isGaMember: false }

describe('resolvePcMenuGroupBadgeLabels', () => {
  it('shows a uniform paid badge on gated sections', () => {
    const items = applyEntitlementMenuBadges(
      [
        { type: 'link', label: '고객리스트', path: '/customers' },
        { type: 'link', label: '고객 지도', path: '/customers/map' },
      ],
      FREE_GENERAL,
    )
    expect(resolvePcMenuGroupBadgeLabels(items)).toEqual(['유료'])
  })

  it('shows paid and GA badges when every child is blocked by both axes', () => {
    const items = applyEntitlementMenuBadges(
      [
        { type: 'link', label: '신청서 작성', path: '/application/documents' },
        { type: 'link', label: '신청서 작성내역', path: '/application/documents/history' },
      ],
      FREE_GENERAL,
    )
    expect(resolvePcMenuGroupBadgeLabels(items)).toEqual(['유료', 'GA 전용'])
  })

  it('hides group badge for mixed free and gated children', () => {
    const items = applyEntitlementMenuBadges(
      [
        { type: 'link', label: '공용안내', path: '/portal/boards/shared-news' },
        {
          type: 'link',
          label: '원수사소식지',
          path: '/portal/newsletters',
        },
      ],
      FREE_GENERAL,
      [{ path: '/portal/boards/shared-news', boardScope: 'global' }],
    )
    expect(resolvePcMenuGroupBadgeLabels(items)).toBeNull()
  })
})
