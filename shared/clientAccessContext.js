/**
 * 사용자 접속 채널·기기 telemetry SSOT (서버·웹·Electron·관리자 UI 공통).
 *
 * - "앱 설치"가 아니라 "실제로 ONE FC 에 접속/사용한" 채널·기기 기록용.
 * - 헤더 값은 telemetry 전용이다. 인증·권한 판단에 절대 사용하지 않는다.
 * - 잘못된 값은 null(미확인)로 안전 처리한다.
 */

/** 접속 채널 enum (DB 저장 값). */
export const CLIENT_TYPES = Object.freeze([
  'web_desktop',
  'web_mobile',
  'desktop_windows',
  'native_android',
  'native_ios',
])

/** 화면 표시명. null/알 수 없음 = '미확인'. */
export const CLIENT_TYPE_LABELS = Object.freeze({
  web_desktop: 'PC 웹',
  web_mobile: '모바일 웹',
  desktop_windows: 'Windows 앱',
  native_android: 'Android 앱',
  native_ios: 'iPhone 앱',
})

export const CLIENT_TYPE_UNKNOWN_LABEL = '미확인'

export const CLIENT_PLATFORMS = Object.freeze(['android', 'ios', 'windows'])

/** 요청 헤더 이름 (HTTP 헤더는 대소문자 무시; Node 는 소문자로 받는다). */
export const ONEFC_CLIENT_HEADERS = Object.freeze({
  clientType: 'X-ONEFC-Client-Type',
  appVersion: 'X-ONEFC-App-Version',
  deviceModel: 'X-ONEFC-Device-Model',
  platform: 'X-ONEFC-Platform',
})

/** last_seen_at 갱신 throttle (15분). */
export const ACCESS_LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000

export const CLIENT_APP_VERSION_MAX_LENGTH = 32
export const CLIENT_DEVICE_MODEL_MAX_LENGTH = 64
export const CLIENT_USER_AGENT_MAX_LENGTH = 512

/** Windows 앱(Electron)이 보내는 기기 표시 값. */
export const DESKTOP_WINDOWS_DEVICE_MODEL = 'Windows PC'

const PLATFORM_BY_CLIENT_TYPE = Object.freeze({
  desktop_windows: 'windows',
  native_android: 'android',
  native_ios: 'ios',
})

function firstHeaderValue(raw) {
  if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : undefined
  return raw
}

/** @returns {string | null} */
export function normalizeClientType(raw) {
  const v = firstHeaderValue(raw)
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (!t || t.length > 32) return null
  return CLIENT_TYPES.includes(t) ? t : null
}

/** @returns {string | null} */
export function normalizeClientPlatform(raw) {
  const v = firstHeaderValue(raw)
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (!t || t.length > 16) return null
  return CLIENT_PLATFORMS.includes(t) ? t : null
}

/** 앱 버전: 숫자·영문·`.+-_` 만, 최대 32자. 그 외는 null. */
export function normalizeClientAppVersion(raw) {
  const v = firstHeaderValue(raw)
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t || t.length > CLIENT_APP_VERSION_MAX_LENGTH) return null
  return /^[0-9A-Za-z][0-9A-Za-z.+\-_]*$/.test(t) ? t : null
}

/** 기기 모델: 제어문자 제거, 글자·숫자·공백·`.,_()+-/` 만, 최대 64자. 그 외는 null. */
export function normalizeClientDeviceModel(raw) {
  const v = firstHeaderValue(raw)
  if (typeof v !== 'string') return null
  const t = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (!t || t.length > CLIENT_DEVICE_MODEL_MAX_LENGTH) return null
  return /^[\p{L}\p{N} .,_()+\-/]+$/u.test(t) ? t : null
}

/** 채널 → 기본 플랫폼 (웹은 null). */
export function platformForClientType(clientType) {
  return (clientType && PLATFORM_BY_CLIENT_TYPE[clientType]) || null
}

/**
 * 일반 브라우저 UA 로 web_desktop / web_mobile 판별.
 * 브라우저가 아닌 UA(okhttp, CFNetwork 등)나 빈 값은 null(미확인).
 */
export function resolveWebClientTypeFromUserAgent(ua) {
  if (typeof ua !== 'string' || !ua.trim()) return null
  if (!/^Mozilla\//.test(ua.trim())) return null
  if (/\bElectron\//.test(ua)) return null
  if (/Mobi|Android|iPhone|iPod|iPad/i.test(ua)) return 'web_mobile'
  return 'web_desktop'
}

/** UA 에서 OS 플랫폼(android|ios|windows) 추정 — 웹 표시용. */
export function resolvePlatformFromUserAgent(ua) {
  if (typeof ua !== 'string') return null
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Windows NT/i.test(ua)) return 'windows'
  return null
}

/** 웹 UA → "OS · 브라우저" 짧은 표시 (예: "Windows · Chrome"). 판별 불가 시 null. */
export function describeWebDeviceFromUserAgent(ua) {
  if (typeof ua !== 'string' || !ua.trim()) return null
  let os = null
  if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPod/i.test(ua)) os = 'iPhone'
  else if (/iPad/i.test(ua)) os = 'iPad'
  else if (/Windows NT/i.test(ua)) os = 'Windows'
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'Mac'
  else if (/CrOS/i.test(ua)) os = 'ChromeOS'
  else if (/Linux/i.test(ua)) os = 'Linux'
  let browser = null
  if (/SamsungBrowser\//.test(ua)) browser = 'Samsung Internet'
  else if (/Whale\//.test(ua)) browser = 'Whale'
  else if (/Edg(A|iOS)?\//.test(ua)) browser = 'Edge'
  else if (/(Firefox|FxiOS)\//.test(ua)) browser = 'Firefox'
  else if (/(Chrome|CriOS)\//.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua)) browser = 'Safari'
  if (!os && !browser) return null
  return [os, browser].filter(Boolean).join(' · ')
}

/**
 * 헤더 + UA 로 접속 컨텍스트를 정한다 (순수 함수).
 * 헤더가 유효하면 우선, 아니면 UA 로 웹 판별, 그래도 모르면 null.
 * @param {Record<string, string | string[] | undefined>} headers 소문자 키 (Node req.headers)
 */
export function resolveClientContextFromHeaders(headers) {
  const h = headers ?? {}
  const rawUa = firstHeaderValue(h['user-agent'])
  const userAgent =
    typeof rawUa === 'string' && rawUa ? rawUa.slice(0, CLIENT_USER_AGENT_MAX_LENGTH) : null
  const headerType = normalizeClientType(h['x-onefc-client-type'])
  if (headerType) {
    const platform =
      normalizeClientPlatform(h['x-onefc-platform']) ?? platformForClientType(headerType)
    let deviceModel = normalizeClientDeviceModel(h['x-onefc-device-model'])
    if (!deviceModel && headerType === 'desktop_windows') deviceModel = DESKTOP_WINDOWS_DEVICE_MODEL
    if (!deviceModel && (headerType === 'web_desktop' || headerType === 'web_mobile')) {
      deviceModel = describeWebDeviceFromUserAgent(userAgent)
    }
    return {
      clientType: headerType,
      platform,
      deviceModel,
      appVersion: normalizeClientAppVersion(h['x-onefc-app-version']),
      userAgent,
    }
  }
  const webType = resolveWebClientTypeFromUserAgent(userAgent)
  if (webType) {
    return {
      clientType: webType,
      platform: resolvePlatformFromUserAgent(userAgent),
      deviceModel: describeWebDeviceFromUserAgent(userAgent),
      appVersion: null,
      userAgent,
    }
  }
  return { clientType: null, platform: null, deviceModel: null, appVersion: null, userAgent }
}

/** 표시명 (null/모름 → '미확인'). */
export function formatClientTypeLabel(clientType) {
  return (clientType && CLIENT_TYPE_LABELS[clientType]) || CLIENT_TYPE_UNKNOWN_LABEL
}
