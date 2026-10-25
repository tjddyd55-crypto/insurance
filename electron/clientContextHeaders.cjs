/**
 * Windows 데스크톱 앱 → ONE FC 서버 요청에만 접속 채널 telemetry 헤더를 붙인다.
 * 헤더 계약: shared/clientAccessContext.js (ONEFC_CLIENT_HEADERS). 인증/권한 판단에 쓰이지 않음.
 * 외부 도메인(카카오, CDN 등) 요청에는 붙이지 않는다.
 */

function toOrigin(url) {
  try {
    const u = new URL(String(url || '').trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

/** @param {string[]} urls */
function resolveAllowedOrigins(urls) {
  return [...new Set((urls || []).map(toOrigin).filter(Boolean))]
}

function buildDesktopClientHeaders(appVersion) {
  const headers = {
    'X-ONEFC-Client-Type': 'desktop_windows',
    'X-ONEFC-Platform': 'windows',
    'X-ONEFC-Device-Model': 'Windows PC',
  }
  const v = String(appVersion || '').trim()
  if (v && v.length <= 32 && /^[0-9A-Za-z][0-9A-Za-z.+\-_]*$/.test(v)) {
    headers['X-ONEFC-App-Version'] = v
  }
  return headers
}

function shouldAttachClientHeaders(requestUrl, allowedOrigins) {
  const origin = toOrigin(requestUrl)
  return Boolean(origin && allowedOrigins.includes(origin))
}

/**
 * @param {import('electron').Session} ses
 * @param {{ appVersion: string, appUrls: string[] }} opts
 */
function installClientContextHeaders(ses, { appVersion, appUrls }) {
  const allowedOrigins = resolveAllowedOrigins(appUrls)
  if (!ses?.webRequest || allowedOrigins.length === 0) return allowedOrigins
  const extra = buildDesktopClientHeaders(appVersion)
  ses.webRequest.onBeforeSendHeaders(
    { urls: allowedOrigins.map((o) => `${o}/*`) },
    (details, callback) => {
      if (!shouldAttachClientHeaders(details.url, allowedOrigins)) {
        callback({ requestHeaders: details.requestHeaders })
        return
      }
      callback({ requestHeaders: { ...details.requestHeaders, ...extra } })
    },
  )
  return allowedOrigins
}

module.exports = {
  buildDesktopClientHeaders,
  installClientContextHeaders,
  resolveAllowedOrigins,
  shouldAttachClientHeaders,
}
