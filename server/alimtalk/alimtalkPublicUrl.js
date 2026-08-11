/**
 * 알림톡 버튼/공개 URL — Railway reverse proxy 가 req.protocol=http 로 넘겨도
 * 승인 템플릿(https://…) 과 불일치하지 않도록 https 로 고정한다.
 * @param {string} url
 */
export function forceHttpsPublicUrl(url) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1') return raw
    if (u.protocol === 'http:') {
      u.protocol = 'https:'
      return u.toString()
    }
    return raw
  } catch {
    return raw.replace(/^http:\/\//i, 'https://')
  }
}

/**
 * @param {string} origin
 */
export function forceHttpsPublicOrigin(origin) {
  const raw = String(origin ?? '')
    .trim()
    .replace(/\/$/, '')
  if (!raw) return ''
  return forceHttpsPublicUrl(raw).replace(/\/$/, '')
}

/**
 * Aligo 웹링크 버튼이 `http(s)://#{변수}` 형태일 때 전달값.
 * scheme 을 한 번 더 붙이지 않도록 `host/path?query` 만 반환한다.
 * @param {string} url
 */
export function toAligoEmbeddedWebLinkValue(url) {
  const full = forceHttpsPublicUrl(String(url ?? '').trim())
  if (!full) return ''
  return full.replace(/^https?:\/\//i, '')
}
