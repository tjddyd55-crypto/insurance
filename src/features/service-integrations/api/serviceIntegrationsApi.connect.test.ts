import { describe, expect, it } from 'vitest'

import { readServiceIntegrationConnectResult } from './serviceIntegrationsApi'

describe('readServiceIntegrationConnectResult', () => {
  it('reads Google OAuth redirect url from enveloped data', () => {
    const result = readServiceIntegrationConnectResult({
      success: true,
      data: { action: 'redirect', url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x' },
    })
    expect(result.url).toContain('accounts.google.com')
  })

  it('reads internal settings path', () => {
    const result = readServiceIntegrationConnectResult({
      data: { action: 'open_settings', path: '/sms/settings' },
    })
    expect(result.path).toBe('/sms/settings')
  })
})
