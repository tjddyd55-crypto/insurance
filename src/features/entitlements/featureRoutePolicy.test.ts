import { describe, expect, it } from 'vitest'
import {
  buildNewsletterBoardSlugScopeMap,
  extractNewsletterBoardSlugFromPath,
  resolveFeatureKeyFromPath,
} from './featureRoutePolicy'
import { FEATURE_KEYS } from './featureEntitlementPolicy'

describe('featureRoutePolicy newsletter boards', () => {
  it('extracts encoded Korean board slug from path', () => {
    expect(extractNewsletterBoardSlugFromPath('/portal/boards/%EA%B3%B5%EC%9A%A9-%EC%86%8C%EC%8B%9D%EC%A7%80')).toBe(
      '공용-소식지',
    )
  })

  it('resolves known global board slugs without API map', () => {
    expect(resolveFeatureKeyFromPath('/portal/boards/shared-news')).toBe(
      FEATURE_KEYS.SHARED_NEWSLETTER,
    )
    expect(resolveFeatureKeyFromPath('/portal/boards/%EA%B3%B5%EC%9A%A9-%EC%86%8C%EC%8B%9D%EC%A7%80')).toBe(
      FEATURE_KEYS.SHARED_NEWSLETTER,
    )
  })

  it('uses slug scope map for dynamic boards', () => {
    const slugScopes = buildNewsletterBoardSlugScopeMap([
      { slug: 'internal-news', boardScope: 'ga' },
      { slug: '공용-소식지', boardScope: 'global' },
    ])
    expect(resolveFeatureKeyFromPath('/portal/boards/internal-news', { newsletterBoardSlugScopes: slugScopes })).toBe(
      FEATURE_KEYS.GA_NEWSLETTER_BOARD,
    )
    expect(
      resolveFeatureKeyFromPath('/portal/boards/%EA%B3%B5%EC%9A%A9-%EC%86%8C%EC%8B%9D%EC%A7%80', {
        newsletterBoardSlugScopes: slugScopes,
      }),
    ).toBe(FEATURE_KEYS.SHARED_NEWSLETTER)
  })

  it('defaults unknown dynamic boards to GA newsletter board feature', () => {
    expect(resolveFeatureKeyFromPath('/portal/boards/unknown-board')).toBe(
      FEATURE_KEYS.GA_NEWSLETTER_BOARD,
    )
  })
})
