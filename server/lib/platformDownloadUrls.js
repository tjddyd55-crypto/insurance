import { getR2PublicCdnBase } from './consentStorage.js'

/** 설치 파일 전용 public downloads 영역 (고객 파일 SSOT와 분리) */
export const PLATFORM_DOWNLOAD_CDN_KEYS = Object.freeze({
  desktopLatest: 'insurance/public/downloads/desktop/latest/insurance-desktop-latest.exe',
  mobileLatest: 'insurance/public/downloads/mobile/latest/insurance-mobile-latest.apk',
})

const FALLBACK_DESKTOP_URL =
  'https://github.com/tjddyd55-crypto/insurance/releases/download/v1.0.234/InsuranceApp-Setup-1.0.234.exe'

/** @deprecated legacy CDN — 파일 미존재 시 FALLBACK_DESKTOP_URL 사용 */
const LEGACY_DESKTOP_URL =
  'https://cdn.platform-assets.com/insurer/download/InsuranceApp%20Setup%201.0.7.exe'

/** 설계사용 Android — Google Play 정식 상세 (SSOT, frontend ANDROID_APP_DOWNLOAD_URL 과 동일) */
export const ANDROID_APP_DOWNLOAD_URL =
  'https://play.google.com/store/apps/details?id=com.onefc.app'

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) {
      return text
    }
  }
  return ''
}

function cdnUrlForKey(objectKey) {
  const key = String(objectKey ?? '').trim().replace(/^\//, '')
  if (!key) {
    return ''
  }
  const base = getR2PublicCdnBase().replace(/\/$/, '')
  if (!base) {
    return ''
  }
  return `${base}/${key}`
}

/** @returns {string} public redirect 대상 URL (없으면 빈 문자열) */
export function resolveDesktopDownloadUrl() {
  return firstNonEmpty(
    process.env.DESKTOP_DOWNLOAD_URL,
    cdnUrlForKey(PLATFORM_DOWNLOAD_CDN_KEYS.desktopLatest),
    process.env.DESKTOP_GITHUB_RELEASE_URL,
    FALLBACK_DESKTOP_URL,
    LEGACY_DESKTOP_URL,
  )
}

/**
 * @returns {string} public redirect 대상 Android 설치 URL
 * Play Store 상세를 기본값으로 사용한다. APK CDN 폴백은 사용하지 않는다.
 */
export function resolveMobileDownloadUrl() {
  return firstNonEmpty(
    process.env.ANDROID_APP_DOWNLOAD_URL,
    process.env.MOBILE_DOWNLOAD_URL,
    process.env.ANDROID_APK_DOWNLOAD_URL,
    ANDROID_APP_DOWNLOAD_URL,
  )
}

export function getPlatformDownloadStatus() {
  return {
    desktop: Boolean(resolveDesktopDownloadUrl()),
    mobile: Boolean(resolveMobileDownloadUrl()),
  }
}
