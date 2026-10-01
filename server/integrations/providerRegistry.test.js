import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  SERVICE_PROVIDERS,
  mapAligoConnectionStatus,
  resolveConnectionStatus,
  resolveProviderAvailability,
} from './providerRegistry.js'

describe('service provider registry', () => {
  it('메뉴가 아니라 설정으로 제공자를 늘린다', () => {
    const keys = SERVICE_PROVIDERS.map((provider) => provider.key)
    assert.deepEqual(keys, [
      'google_calendar',
      'google_drive',
      'google_gmail',
      'naver_calendar',
      'aligo_sms',
      'ga_insurer_api',
      'nhis_hira',
    ])
  })

  it('OAuth 클라이언트 ID가 없으면 미설정이다', () => {
    const google = SERVICE_PROVIDERS.find((provider) => provider.key === 'google_calendar')
    assert.equal(resolveProviderAvailability(google, {}), 'unconfigured')
    assert.equal(
      resolveProviderAvailability(google, { GOOGLE_OAUTH_CLIENT_ID: 'client' }),
      'ready',
    )
    assert.equal(
      resolveConnectionStatus('unconfigured', 'connected'),
      'unconfigured',
    )
    assert.equal(resolveConnectionStatus('ready', null), 'disconnected')
    assert.equal(resolveConnectionStatus('ready', 'error'), 'error')
  })

  it('미래 제공자와 알리고 상태를 구분한다', () => {
    const gmail = SERVICE_PROVIDERS.find((provider) => provider.key === 'google_gmail')
    assert.equal(resolveProviderAvailability(gmail, { GOOGLE_OAUTH_CLIENT_ID: 'x' }), 'unconfigured')
    assert.equal(mapAligoConnectionStatus({ configured: false }), 'disconnected')
    assert.equal(
      mapAligoConnectionStatus({ configured: true, isActive: true, apiKeyMasked: '****abcd' }),
      'connected',
    )
    assert.equal(
      mapAligoConnectionStatus({ configured: true, isActive: true, apiKeyMasked: '********' }),
      'error',
    )
    assert.equal(
      mapAligoConnectionStatus({ configured: false, providerMisconfigured: true }),
      'unconfigured',
    )
  })
})
