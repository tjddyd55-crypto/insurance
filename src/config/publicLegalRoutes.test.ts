import { describe, expect, it } from 'vitest'
import { termsSiteConfig } from '../features/legal/termsSiteConfig'

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

  it('uses the same operator name as terms config', () => {
    expect(termsSiteConfig.operatorLegalName).toBe('올인원솔루션')
    expect(termsSiteConfig.lastRevisedDate).toBe('2026년 7월 13일')
  })
})
