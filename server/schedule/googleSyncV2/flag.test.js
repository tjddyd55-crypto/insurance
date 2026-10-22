import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOnefcGoogleSyncV2Enabled } from './flag.js'

describe('ONEFC_GOOGLE_SYNC_V2', () => {
  it('기본값은 꺼져 있다', () => {
    assert.equal(isOnefcGoogleSyncV2Enabled({ NODE_ENV: 'development', RAILWAY_ENVIRONMENT: 'development' }), false)
    assert.equal(isOnefcGoogleSyncV2Enabled({ NODE_ENV: 'test' }), false)
    assert.equal(isOnefcGoogleSyncV2Enabled({ NODE_ENV: 'development', ONEFC_GOOGLE_SYNC_V2: 'false' }), false)
    assert.equal(isOnefcGoogleSyncV2Enabled({ NODE_ENV: 'development', ONEFC_GOOGLE_SYNC_V2: '0' }), false)
  })

  it('Development 에서만 명시적으로 켠다. NODE_ENV=production 이어도 Railway development 는 Dev 다', () => {
    const env = { NODE_ENV: 'production', RAILWAY_ENVIRONMENT: 'development', ONEFC_GOOGLE_SYNC_V2: 'true' }
    assert.equal(isOnefcGoogleSyncV2Enabled(env), true)
    assert.equal(isOnefcGoogleSyncV2Enabled({ NODE_ENV: 'test', ONEFC_GOOGLE_SYNC_V2: 'on' }), true)
    assert.equal(isOnefcGoogleSyncV2Enabled({ NODE_ENV: 'test', ONEFC_GOOGLE_SYNC_V2: '1' }), true)
  })

  it('운영 런타임에서는 환경 변수를 켜도 항상 꺼져 있다', () => {
    assert.equal(isOnefcGoogleSyncV2Enabled({ NODE_ENV: 'production', ONEFC_GOOGLE_SYNC_V2: 'true' }), false)
    assert.equal(isOnefcGoogleSyncV2Enabled({ RAILWAY_ENVIRONMENT: 'production', NODE_ENV: 'development', ONEFC_GOOGLE_SYNC_V2: 'true' }), false)
    assert.equal(isOnefcGoogleSyncV2Enabled({ APP_ENV: 'prod', NODE_ENV: 'development', ONEFC_GOOGLE_SYNC_V2: 'yes' }), false)
  })
})
