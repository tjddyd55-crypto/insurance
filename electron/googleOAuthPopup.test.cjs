const test = require('node:test')
const assert = require('node:assert/strict')
const m = require('./googleOAuthPopup.cjs')

const PROD = 'https://insurance-production-7bd8.up.railway.app'
const DEV = 'https://insurance-dev.up.railway.app'

test('Google 동의 시작 URL 만 팝업 대상', () => {
  assert.equal(m.isGoogleOAuthStartUrl('https://accounts.google.com/o/oauth2/v2/auth?client_id=x'), true)
  assert.equal(m.isGoogleOAuthStartUrl('https://accounts.google.com/ServiceLogin'), false)
  assert.equal(m.isGoogleOAuthStartUrl('http://accounts.google.com/o/oauth2/v2/auth'), false)
  assert.equal(m.isGoogleOAuthStartUrl('https://evil.example/o/oauth2/v2/auth'), false)
  assert.equal(m.isGoogleOAuthStartUrl('https://accounts.google.com.evil.example/o/oauth2/'), false)
})

test('prod: 공식 도메인 callback 을 앱 origin(Railway host)으로 옮기고 query 를 보존', () => {
  const r = m.callbackOnAppOrigin('https://onefc.platform-assets.com/backend/service-integrations/google/callback?state=S&code=C&scope=a%20b', PROD)
  assert.deepEqual(r, { url: `${PROD}/backend/service-integrations/google/callback?state=S&code=C&scope=a%20b`, rewritten: true })
})

test('dev: callback host 가 앱 origin 과 같으면 그대로 진행', () => {
  assert.deepEqual(m.callbackOnAppOrigin(`${DEV}/backend/service-integrations/google/callback?state=S`, DEV), { url: `${DEV}/backend/service-integrations/google/callback?state=S`, rewritten: false })
})

test('신뢰하지 않는 host·다른 path 는 callback 으로 취급하지 않는다', () => {
  assert.equal(m.callbackOnAppOrigin('https://evil.example/backend/service-integrations/google/callback?code=C', PROD), null)
  assert.equal(m.callbackOnAppOrigin('https://onefc.platform-assets.com/backend/other?code=C', PROD), null)
  assert.equal(m.callbackOnAppOrigin('http://onefc.platform-assets.com/backend/service-integrations/google/callback', PROD), null)
})

test('결과 화면 감지는 앱 origin + /service-integrations?google= 만', () => {
  assert.equal(m.isReturnUrl(`${PROD}/service-integrations?google=connected`, PROD), true)
  assert.equal(m.isReturnUrl(`${PROD}/service-integrations?google=error&reason=session_mismatch`, PROD), true)
  assert.equal(m.isReturnUrl(`${PROD}/service-integrations`, PROD), false)
  assert.equal(m.isReturnUrl('https://onefc.platform-assets.com/service-integrations?google=connected', PROD), false)
})

test('팝업 안 이동: Google 로그인 host 만 허용', () => {
  assert.equal(m.isGoogleSignInUrl('https://accounts.google.com/signin/oauth/consent?x'), true)
  assert.equal(m.isGoogleSignInUrl('https://example.com'), false)
})

function fakeElectron() {
  const handlers = {}
  const opened = []
  let loaded = []
  let closed = false
  let closeCb = null
  class BW {
    constructor(opts) { this.opts = opts; this.webContents = { on: (n, f) => { handlers[n] = f }, setWindowOpenHandler: (f) => { handlers.open = f } } }
    loadURL(u) { loaded.push(u); return Promise.resolve() }
    isDestroyed() { return closed }
    close() { closed = true; closeCb && closeCb() }
    on(n, f) { if (n === 'closed') closeCb = f }
  }
  return { BW, handlers, opened, get loaded() { return loaded }, get closed() { return closed }, shell: { openExternal: (u) => opened.push(u) } }
}
const ev = () => { const e = { prevented: false, preventDefault() { e.prevented = true } }; return e }

test('팝업 흐름: 같은 session 창 → callback host 교체 → 결과 화면에서 닫고 메인 창 이동', () => {
  const f = fakeElectron()
  let done
  m.openGoogleOAuthPopup({ BrowserWindow: f.BW, shell: f.shell, parent: {}, startUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x', appOrigin: PROD, onDone: (u) => { done = u } })
  assert.equal(f.loaded[0], 'https://accounts.google.com/o/oauth2/v2/auth?x')
  let e = ev(); f.handlers['will-navigate'](e, 'https://accounts.google.com/signin/oauth/consent'); assert.equal(e.prevented, false)
  e = ev(); f.handlers['will-redirect'](e, 'https://onefc.platform-assets.com/backend/service-integrations/google/callback?state=S&code=C')
  assert.equal(e.prevented, true)
  assert.equal(f.loaded[1], `${PROD}/backend/service-integrations/google/callback?state=S&code=C`)
  e = ev(); f.handlers['will-redirect'](e, `${PROD}/backend/service-integrations/google/callback?state=S&code=C`); assert.equal(e.prevented, false)
  e = ev(); f.handlers['will-redirect'](e, `${PROD}/service-integrations?google=connected`)
  assert.equal(e.prevented, true)
  assert.equal(done, `${PROD}/service-integrations?google=connected`)
  assert.equal(f.closed, true)
})

test('팝업 흐름: 외부 링크는 시스템 브라우저, 사용자가 닫으면 onDone(null)', () => {
  const f = fakeElectron()
  let done = 'unset'
  const p = m.openGoogleOAuthPopup({ BrowserWindow: f.BW, shell: f.shell, parent: {}, startUrl: 'https://accounts.google.com/o/oauth2/v2/auth', appOrigin: PROD, onDone: (u) => { done = u } })
  const e = ev(); f.handlers['will-navigate'](e, 'https://policies.google.com/privacy'); assert.equal(e.prevented, true)
  assert.deepEqual(f.opened, ['https://policies.google.com/privacy'])
  assert.deepEqual(f.handlers.open({ url: 'https://support.google.com/x' }), { action: 'deny' })
  p.close()
  assert.equal(done, null)
  assert.equal(p.opts.webPreferences.nodeIntegration, false)
  assert.equal(p.opts.webPreferences.contextIsolation, true)
})
