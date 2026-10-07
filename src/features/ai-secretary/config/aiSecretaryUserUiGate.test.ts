import { describe, expect, it } from 'vitest'

import { resolveAiSecretaryUserUiEnabled } from './aiSecretaryUserUiGate'

describe('resolveAiSecretaryUserUiEnabled', () => {
  it('allows UI on vite dev even on production host', () => {
    expect(
      resolveAiSecretaryUserUiEnabled({
        isViteDev: true,
        isProdBundle: false,
        hostname: 'onefc.platform-assets.com',
      }),
    ).toBe(true)
  })

  it('blocks UI on production bundle for official production host', () => {
    expect(
      resolveAiSecretaryUserUiEnabled({
        isViteDev: false,
        isProdBundle: true,
        hostname: 'onefc.platform-assets.com',
      }),
    ).toBe(false)
  })

  it('blocks UI on production bundle for www production host', () => {
    expect(
      resolveAiSecretaryUserUiEnabled({
        isViteDev: false,
        isProdBundle: true,
        hostname: 'www.onefc.platform-assets.com',
      }),
    ).toBe(false)
  })

  it('allows UI on railway dev host with production bundle', () => {
    expect(
      resolveAiSecretaryUserUiEnabled({
        isViteDev: false,
        isProdBundle: true,
        hostname: 'insurance-dev.up.railway.app',
      }),
    ).toBe(true)
  })

  it('blocks UI on production bundle when hostname is empty', () => {
    expect(
      resolveAiSecretaryUserUiEnabled({
        isViteDev: false,
        isProdBundle: true,
        hostname: '',
      }),
    ).toBe(false)
  })
})
