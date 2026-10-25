import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCESS_LAST_SEEN_THROTTLE_MS,
  CLIENT_TYPES,
  formatClientTypeLabel,
  resolveClientContextFromHeaders,
} from '../../shared/clientAccessContext.js'
import { resolveClientContext } from './clientContext.js'
import {
  recordUserAccessContext,
  resetUserAccessContextThrottleForTests,
  RECORD_USER_ACCESS_CONTEXT_SQL,
} from './userAccessContext.js'
import { loadAdminUserAccessContext } from './adminUserAccessContext.js'

const UA_WIN_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const UA_ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; SM-S931N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
const UA_IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const UA_ELECTRON =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ONEFC/1.0.7 Chrome/130.0.0.0 Electron/33.0.0 Safari/537.36'

test('SSOT enum 5종 + 표시명, null=미확인', () => {
  assert.deepEqual(CLIENT_TYPES, ['web_desktop', 'web_mobile', 'desktop_windows', 'native_android', 'native_ios'])
  assert.equal(formatClientTypeLabel('web_desktop'), 'PC 웹')
  assert.equal(formatClientTypeLabel('native_ios'), 'iPhone 앱')
  assert.equal(formatClientTypeLabel(null), '미확인')
  assert.equal(formatClientTypeLabel('bogus'), '미확인')
  assert.equal(ACCESS_LAST_SEEN_THROTTLE_MS, 15 * 60 * 1000)
})

test('1) desktop UA → web_desktop', () => {
  const c = resolveClientContextFromHeaders({ 'user-agent': UA_WIN_CHROME })
  assert.equal(c.clientType, 'web_desktop')
  assert.equal(c.platform, 'windows')
  assert.equal(c.deviceModel, 'Windows · Chrome')
  assert.equal(c.appVersion, null)
})

test('2) mobile UA → web_mobile (Android / iPhone)', () => {
  const a = resolveClientContextFromHeaders({ 'user-agent': UA_ANDROID_CHROME })
  assert.equal(a.clientType, 'web_mobile')
  assert.equal(a.platform, 'android')
  assert.equal(a.deviceModel, 'Android · Chrome')
  const i = resolveClientContextFromHeaders({ 'user-agent': UA_IPHONE_SAFARI })
  assert.equal(i.clientType, 'web_mobile')
  assert.equal(i.deviceModel, 'iPhone · Safari')
})

test('3) Windows 앱 헤더 → desktop_windows (+ 기본 기기 Windows PC)', () => {
  const c = resolveClientContextFromHeaders({
    'user-agent': UA_ELECTRON,
    'x-onefc-client-type': 'desktop_windows',
    'x-onefc-app-version': '1.0.7',
    'x-onefc-platform': 'windows',
  })
  assert.deepEqual(
    { t: c.clientType, p: c.platform, d: c.deviceModel, v: c.appVersion },
    { t: 'desktop_windows', p: 'windows', d: 'Windows PC', v: '1.0.7' },
  )
})

test('Electron UA 인데 헤더 없음 → 일반 브라우저로 오인하지 않음(미확인)', () => {
  assert.equal(resolveClientContextFromHeaders({ 'user-agent': UA_ELECTRON }).clientType, null)
})

test('4) native android / ios 헤더', () => {
  const a = resolveClientContextFromHeaders({
    'user-agent': 'okhttp/4.12.0',
    'x-onefc-client-type': 'native_android',
    'x-onefc-app-version': '2.3.1',
    'x-onefc-device-model': 'SM-S931N',
    'x-onefc-platform': 'android',
  })
  assert.deepEqual([a.clientType, a.platform, a.deviceModel, a.appVersion], ['native_android', 'android', 'SM-S931N', '2.3.1'])
  const i = resolveClientContextFromHeaders({
    'user-agent': 'ONEFC/12 CFNetwork/1568 Darwin/24.0.0',
    'X-ONEFC-CLIENT-TYPE': 'ignored-uppercase-key', // Node 는 소문자 키로만 전달
    'x-onefc-client-type': 'NATIVE_IOS',
    'x-onefc-device-model': 'iPhone17,1',
  })
  assert.deepEqual([i.clientType, i.platform, i.deviceModel], ['native_ios', 'ios', 'iPhone17,1'])
})

test('5) 잘못된 헤더 → 안전 fallback (null / UA 판별)', () => {
  const bad = resolveClientContextFromHeaders({
    'user-agent': UA_WIN_CHROME,
    'x-onefc-client-type': 'admin',
    'x-onefc-app-version': '1.0.7; DROP TABLE users',
    'x-onefc-device-model': '<script>x</script>',
    'x-onefc-platform': 'linux',
  })
  assert.equal(bad.clientType, 'web_desktop')
  assert.equal(bad.appVersion, null)
  const native = resolveClientContextFromHeaders({
    'user-agent': 'okhttp/4.12.0',
    'x-onefc-client-type': 'native_android',
    'x-onefc-app-version': 'x'.repeat(33),
    'x-onefc-device-model': '<b>Galaxy</b>',
    'x-onefc-platform': 'symbian',
  })
  assert.equal(native.clientType, 'native_android')
  assert.equal(native.appVersion, null)
  assert.equal(native.deviceModel, null)
  assert.equal(native.platform, 'android')
  assert.equal(resolveClientContextFromHeaders({ 'user-agent': 'okhttp/4.12.0' }).clientType, null)
  assert.equal(resolveClientContextFromHeaders({}).clientType, null)
  assert.equal(resolveClientContextFromHeaders(null).clientType, null)
  const longUa = resolveClientContextFromHeaders({ 'user-agent': `Mozilla/5.0 ${'a'.repeat(2000)}` })
  assert.equal(longUa.userAgent.length, 512)
})

test('resolveClientContext(req) 는 IP 를 기존 규칙(x-forwarded-for 첫 값)으로', () => {
  const c = resolveClientContext({
    headers: { 'user-agent': UA_WIN_CHROME, 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    socket: { remoteAddress: '10.0.0.9' },
  })
  assert.equal(c.ip, '203.0.113.5')
  assert.equal(c.clientType, 'web_desktop')
})

function countingPool(rowCount = 1) {
  const calls = []
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params })
      return { rowCount, rows: [] }
    },
  }
}

const WEB_CTX = { clientType: 'web_desktop', deviceModel: 'Windows · Chrome', appVersion: null }

test('8) last_seen throttle: 15분 이내 같은 컨텍스트는 DB 호출 skip, 이후 update', async () => {
  resetUserAccessContextThrottleForTests()
  const pool = countingPool()
  const t0 = 1_800_000_000_000
  assert.equal((await recordUserAccessContext(pool, 'u1', WEB_CTX, { nowMs: t0 })).status, 'written')
  for (let i = 1; i <= 50; i += 1) {
    const r = await recordUserAccessContext(pool, 'u1', WEB_CTX, { nowMs: t0 + i * 1000 })
    assert.equal(r.status, 'skipped_memory')
  }
  assert.equal(pool.calls.length, 1, '51 요청 중 DB 호출 1회')
  const late = await recordUserAccessContext(pool, 'u1', WEB_CTX, { nowMs: t0 + ACCESS_LAST_SEEN_THROTTLE_MS })
  assert.equal(late.status, 'written')
  assert.equal(pool.calls.length, 2)
  const p = pool.calls[0].params
  assert.deepEqual(p, ['u1', 'web_desktop', 'Windows · Chrome', null, false, String(ACCESS_LAST_SEEN_THROTTLE_MS)])
})

test('채널이 바뀌면 15분 이내라도 기록 (last_client_type 갱신 기회)', async () => {
  resetUserAccessContextThrottleForTests()
  const pool = countingPool()
  const t0 = 1_800_000_000_000
  await recordUserAccessContext(pool, 'u2', WEB_CTX, { nowMs: t0 })
  await recordUserAccessContext(pool, 'u2', { clientType: 'desktop_windows', deviceModel: 'Windows PC', appVersion: '1.0.7' }, { nowMs: t0 + 1000 })
  assert.equal(pool.calls.length, 2)
  assert.equal(pool.calls[1].params[1], 'desktop_windows')
})

test('force(로그인 성공)는 메모리 throttle 무시', async () => {
  resetUserAccessContextThrottleForTests()
  const pool = countingPool()
  await recordUserAccessContext(pool, 'u3', WEB_CTX, { nowMs: 1 })
  await recordUserAccessContext(pool, 'u3', WEB_CTX, { nowMs: 2, force: true })
  assert.equal(pool.calls.length, 2)
  assert.equal(pool.calls[1].params[4], true)
})

test('비인증(userId 없음)은 기록 안 함, DB 오류는 throw 하지 않음(best-effort)', async () => {
  resetUserAccessContextThrottleForTests()
  const pool = countingPool()
  assert.equal((await recordUserAccessContext(pool, '', WEB_CTX)).status, 'skipped_invalid')
  assert.equal((await recordUserAccessContext(pool, null, WEB_CTX)).status, 'skipped_invalid')
  assert.equal(pool.calls.length, 0)
  const errPool = { query: async () => { throw new Error('column does not exist') } }
  const origErr = console.error
  console.error = () => {}
  try {
    assert.equal((await recordUserAccessContext(errPool, 'u4', WEB_CTX, { nowMs: 10 })).status, 'error')
    // 오류 후에도 15분간 재시도로 DB 를 두드리지 않음
    assert.equal((await recordUserAccessContext(errPool, 'u4', WEB_CTX, { nowMs: 20 })).status, 'skipped_memory')
  } finally {
    console.error = origErr
  }
})

test('SQL: first_client_type 은 COALESCE(기존값 우선) — overwrite 없음, throttle 조건 포함', () => {
  assert.match(RECORD_USER_ACCESS_CONTEXT_SQL, /first_client_type = COALESCE\(first_client_type, \$2::text\)/)
  assert.match(RECORD_USER_ACCESS_CONTEXT_SQL, /last_seen_at < NOW\(\) - \(\$6::text \|\| ' milliseconds'\)::interval/)
  assert.doesNotMatch(RECORD_USER_ACCESS_CONTEXT_SQL, /last_login_at|last_login_ip|last_login_user_agent/)
})

test('11) 권한 isolation: GA_ADMIN forcedGaId 가 users 조회 조건으로 바인딩, 다른 GA 는 null', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (/FROM users u/.test(sql)) {
        // 사용자 ga_id=7 로 가정: forcedGaId 7 또는 null 만 통과
        const ok = params[1] == null || params[1] === 7
        return { rows: ok ? [{ id: 'u9', created_at: new Date(0), last_client_type: 'web_desktop' }] : [] }
      }
      return { rows: [] }
    },
  }
  assert.equal(await loadAdminUserAccessContext(pool, { userId: 'u9', forcedGaId: 3 }), null)
  assert.equal(calls.length, 1, '다른 GA 면 세션 이력 조회조차 안 함')
  assert.match(calls[0].sql, /\$2::int IS NULL OR u\.ga_id = \$2::int/)
  const ok = await loadAdminUserAccessContext(pool, { userId: 'u9', forcedGaId: 7 })
  assert.equal(ok.userId, 'u9')
  assert.deepEqual(ok.usedClientTypes, ['web_desktop'])
  assert.equal(JSON.stringify(ok).includes('ip'), false, '응답에 IP 없음')
  assert.ok(await loadAdminUserAccessContext(pool, { userId: 'u9', forcedGaId: null }))
})
