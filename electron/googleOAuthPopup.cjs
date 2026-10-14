/**
 * 데스크톱 앱 Google 연동: 동의 화면을 시스템 브라우저가 아니라 앱 안 팝업 창(같은 session)에서 연다.
 *
 * 왜:
 *   서버는 연동 시작 시 HttpOnly 바인딩 쿠키를 "앱이 부르는 host" 에 심고, callback 에서 그 쿠키를 확인한다.
 *   시스템 Chrome 에서 동의하면 쿠키가 없어 session_mismatch 로 실패한다.
 *   또 Google redirect_uri 는 공식 도메인(onefc.platform-assets.com)인데 패키지 앱은 Railway host 를 부르므로
 *   host 도 다르다. 그래서 팝업이 callback 으로 갈 때 "같은 path·query 를 앱 origin 으로" 다시 불러,
 *   같은 session 의 쿠키가 실리게 한다. 서버 state/쿠키 검증은 그대로다(토큰 교환은 서버 설정 redirect_uri 로 한다).
 */

const GOOGLE_AUTH_HOST = 'accounts.google.com'
const GOOGLE_AUTH_PATH_PREFIX = '/o/oauth2/'
const GOOGLE_CALLBACK_PATH = '/backend/service-integrations/google/callback'
const RETURN_PATH = '/service-integrations'
/** Google 에 등록된 redirect_uri host. 앱 origin 과 다르면 callback 을 앱 origin 으로 옮겨 연다. */
const TRUSTED_CALLBACK_HOSTS = Object.freeze(['onefc.platform-assets.com', 'insurance-dev.up.railway.app', 'insurance-production-7bd8.up.railway.app'])

function parse(raw) {
  try {
    return new URL(String(raw ?? '').trim())
  } catch {
    return null
  }
}

/** 앱(메인 창)이 Google 동의 시작 URL 로 이동하려는가. */
function isGoogleOAuthStartUrl(raw) {
  const u = parse(raw)
  return Boolean(u && u.protocol === 'https:' && u.hostname === GOOGLE_AUTH_HOST && u.pathname.startsWith(GOOGLE_AUTH_PATH_PREFIX))
}

/** Google 로그인·동의 과정에서 팝업 안에 머물러도 되는 주소. */
function isGoogleSignInUrl(raw) {
  const u = parse(raw)
  if (!u || u.protocol !== 'https:') return false
  return u.hostname === GOOGLE_AUTH_HOST
}

/**
 * callback URL 이면 앱 origin 으로 옮긴 URL, 아니면 null.
 * @param {string} raw
 * @param {string} appOrigin 예: https://insurance-production-7bd8.up.railway.app
 * @returns {{ url: string, rewritten: boolean } | null}
 */
function callbackOnAppOrigin(raw, appOrigin) {
  const u = parse(raw)
  const app = parse(appOrigin)
  if (!u || !app || u.protocol !== 'https:' && u.hostname !== 'localhost') return null
  if (u.pathname !== GOOGLE_CALLBACK_PATH) return null
  if (u.origin === app.origin) return { url: u.toString(), rewritten: false }
  if (!TRUSTED_CALLBACK_HOSTS.includes(u.hostname)) return null
  return { url: `${app.origin}${u.pathname}${u.search}`, rewritten: true }
}

/** 서버 callback 이 돌려보내는 앱 화면(/service-integrations?google=...)인가. */
function isReturnUrl(raw, appOrigin) {
  const u = parse(raw)
  const app = parse(appOrigin)
  return Boolean(u && app && u.origin === app.origin && u.pathname === RETURN_PATH && u.searchParams.has('google'))
}

/**
 * @param {{ BrowserWindow: any, shell: any, parent: any, startUrl: string, appOrigin: string, onDone: (returnUrl: string | null) => void }} deps
 */
function openGoogleOAuthPopup({ BrowserWindow, shell, parent, startUrl, appOrigin, onDone }) {
  let finished = false
  const popup = new BrowserWindow({
    parent,
    modal: false,
    width: 520,
    height: 720,
    show: true,
    autoHideMenuBar: true,
    title: 'Google 연동',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  const finish = (returnUrl) => {
    if (finished) return
    finished = true
    onDone(returnUrl)
    if (!popup.isDestroyed()) popup.close()
  }
  const route = (event, url) => {
    if (isReturnUrl(url, appOrigin)) {
      event.preventDefault()
      finish(url)
      return
    }
    const cb = callbackOnAppOrigin(url, appOrigin)
    if (cb) {
      if (cb.rewritten) {
        event.preventDefault()
        void popup.loadURL(cb.url)
      }
      return
    }
    if (isGoogleSignInUrl(url)) return
    event.preventDefault()
    if (/^https?:/i.test(String(url))) void shell.openExternal(url)
  }
  popup.webContents.on('will-navigate', route)
  popup.webContents.on('will-redirect', route)
  popup.webContents.on('did-navigate', (_e, url) => {
    if (isReturnUrl(url, appOrigin)) finish(url)
  })
  popup.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(String(url))) void shell.openExternal(url)
    return { action: 'deny' }
  })
  popup.on('closed', () => {
    if (!finished) {
      finished = true
      onDone(null)
    }
  })
  void popup.loadURL(startUrl)
  return popup
}

module.exports = {
  GOOGLE_CALLBACK_PATH,
  TRUSTED_CALLBACK_HOSTS,
  isGoogleOAuthStartUrl,
  isGoogleSignInUrl,
  callbackOnAppOrigin,
  isReturnUrl,
  openGoogleOAuthPopup,
}
