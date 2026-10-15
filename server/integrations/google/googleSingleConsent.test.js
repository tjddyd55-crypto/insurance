import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGoogleAuthorizationUrl } from './googleTokenService.js'
import { connectExtraScopes } from '../../apis/registerGoogleIntegrationApi.js'
import { GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_WRITE_SCOPES } from './googleOAuthConfig.js'

const cfg = { clientId: 'cid', redirectUri: 'https://x/cb' }
const scopes = (url) => new URL(url).searchParams.get('scope').split(' ')

test('flags OFF: settings connect asks exactly the same scopes as before', () => {
  assert.deepEqual(connectExtraScopes({ feature: 'calendar' }, {}), [])
  assert.deepEqual(connectExtraScopes({ feature: 'drive' }, {}), [])
  const before = buildGoogleAuthorizationUrl(cfg, 's', {})
  const after = buildGoogleAuthorizationUrl(cfg, 's', { extraScopes: connectExtraScopes({ feature: 'calendar' }, {}) })
  assert.equal(after, before)
})

test('flags ON: calendar entry adds calendar.events + tasks, drive entry adds drive.file only', () => {
  const cal = connectExtraScopes({ feature: 'calendar' }, { GOOGLE_WRITE_ENABLED: 'true' })
  assert.deepEqual(cal, [...GOOGLE_WRITE_SCOPES])
  const drive = connectExtraScopes({ feature: 'drive' }, { GOOGLE_DRIVE_ENABLED: 'true', GOOGLE_WRITE_ENABLED: 'true' })
  assert.deepEqual(drive, [GOOGLE_DRIVE_FILE_SCOPE])
  const url = buildGoogleAuthorizationUrl(cfg, 's', { extraScopes: cal })
  for (const s of GOOGLE_WRITE_SCOPES) assert.ok(scopes(url).includes(s))
  assert.ok(!scopes(url).includes(GOOGLE_DRIVE_FILE_SCOPE))
  assert.match(new URL(url).searchParams.get('prompt'), /select_account/)
})

test('incremental purposes keep same-account prompt and no duplicate scopes', () => {
  const url = buildGoogleAuthorizationUrl(cfg, 's', { purpose: 'drive', loginHint: 'a@b.c', extraScopes: [GOOGLE_DRIVE_FILE_SCOPE] })
  const list = scopes(url)
  assert.equal(list.filter((s) => s === GOOGLE_DRIVE_FILE_SCOPE).length, 1)
  assert.equal(new URL(url).searchParams.get('login_hint'), 'a@b.c')
  assert.equal(new URL(url).searchParams.get('prompt'), 'consent')
})
