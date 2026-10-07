import { describe, expect, it } from 'vitest'
import { termsSiteConfig } from '../features/legal/termsSiteConfig'
import { PUBLIC_LEGAL_PATHS, isPublicLegalPath } from '../features/legal/legalPageNavigation'

export const PUBLIC_LEGAL_FOOTER_ROUTES = {
  terms: '/terms',
  privacy: '/privacy',
  accountDeletion: '/account-deletion',
} as const

describe('public legal routes', () => {
  it('exposes terms route for footer navigation', () => {
    expect(PUBLIC_LEGAL_FOOTER_ROUTES.terms).toBe('/terms')
    expect(PUBLIC_LEGAL_FOOTER_ROUTES.privacy).toBe('/privacy')
    expect(PUBLIC_LEGAL_FOOTER_ROUTES.accountDeletion).toBe('/account-deletion')
  })

  it('keeps public legal path SSOT aligned', () => {
    expect(PUBLIC_LEGAL_PATHS).toEqual(
      expect.arrayContaining(['/terms', '/privacy', '/account-deletion', '/privacy-policy']),
    )
    expect(isPublicLegalPath('/terms')).toBe(true)
  })

  it('uses the same operator name as terms config', () => {
    expect(termsSiteConfig.operatorLegalName).toBe('올인원솔루션')
    expect(termsSiteConfig.lastRevisedDate).toBe('2026년 7월 13일')
  })
})
