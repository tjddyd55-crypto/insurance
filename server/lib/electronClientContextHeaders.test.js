import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { resolveClientContextFromHeaders } from '../../shared/clientAccessContext.js'

const require = createRequire(import.meta.url)
const {
  buildDesktopClientHeaders,
  installClientContextHeaders,
  shouldAttachClientHeaders,
} = require('../../electron/clientContextHeaders.cjs')

const APP = 'https://insurance-production-7bd8.up.railway.app'

test('Electron 헤더 → 서버 판별 desktop_windows (계약 일치)', () => {
  const h = buildDesktopClientHeaders('1.0.7')
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]))
  const c = resolveClientContextFromHeaders({ ...lower, 'user-agent': 'Mozilla/5.0 Electron/33' })
  assert.deepEqual([c.clientType, c.platform, c.deviceModel, c.appVersion], ['desktop_windows', 'windows', 'Windows PC', '1.0.7'])
  assert.equal(buildDesktopClientHeaders('bad version!')['X-ONEFC-App-Version'], undefined)
})

test('우리 서버 origin 에만 헤더 부착, 외부 도메인 제외', () => {
  const allowed = [APP]
  assert.equal(shouldAttachClientHeaders(`${APP}/api/auth/me`, allowed), true)
  assert.equal(shouldAttachClientHeaders('https://kauth.kakao.com/oauth', allowed), false)
  assert.equal(shouldAttachClientHeaders(`${APP}.evil.com/api`, allowed), false)
  assert.equal(shouldAttachClientHeaders('file:///C:/x', allowed), false)
})

test('installClientContextHeaders: filter 는 origin/* 만, callback 에 헤더 merge', () => {
  let filter
  let listener
  const ses = { webRequest: { onBeforeSendHeaders: (f, l) => { filter = f; listener = l } } }
  installClientContextHeaders(ses, { appVersion: '1.0.7', appUrls: [`${APP}/some/path`] })
  assert.deepEqual(filter, { urls: [`${APP}/*`] })
  let out
  listener({ url: `${APP}/api/x`, requestHeaders: { Accept: 'json' } }, (r) => { out = r })
  assert.equal(out.requestHeaders['X-ONEFC-Client-Type'], 'desktop_windows')
  assert.equal(out.requestHeaders.Accept, 'json')
  listener({ url: 'https://cdn.example.com/a.js', requestHeaders: { A: '1' } }, (r) => { out = r })
  assert.deepEqual(out.requestHeaders, { A: '1' })
})
