import { describe, expect, it } from 'vitest'

import { resolveAdvisorThemeDevReviewEnabled } from './advisorThemeDevReviewGate'

describe('resolveAdvisorThemeDevReviewEnabled', () => {
  it('blocks on production bundle and production host', () => {
    expect(
      resolveAdvisorThemeDevReviewEnabled({
        isViteDev: false,
        isProdBundle: true,
        hostname: 'onefc.platform-assets.com',
      }),
    ).toBe(false)
  })

  it('allows on railway development host with production bundle', () => {
    expect(
      resolveAdvisorThemeDevReviewEnabled({
        isViteDev: false,
        isProdBundle: true,
        hostname: 'insurance-dev.up.railway.app',
      }),
    ).toBe(true)
  })

  it('allows on vite dev', () => {
    expect(
      resolveAdvisorThemeDevReviewEnabled({
        isViteDev: true,
        isProdBundle: false,
        hostname: 'localhost',
      }),
    ).toBe(true)
  })
})
