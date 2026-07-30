const DOWNLOAD_CACHE_BUST = 'v=1781884175110-desktop-6479384'

export const DESKTOP_DOWNLOAD_URL = `https://cdn.platform-assets.com/insurance/download/one-fc-pc.exe?${DOWNLOAD_CACHE_BUST}`

/**
 * 설계사용 ONE FC Android — Google Play 정식 상세 페이지 (SSOT).
 * 로그인·소개/설치 등 사용자 노출 Android 다운로드는 이 상수만 사용한다.
 */
export const ANDROID_APP_DOWNLOAD_URL =
  'https://play.google.com/store/apps/details?id=com.onefc.app'

/** @deprecated ANDROID_APP_DOWNLOAD_URL 사용 */
export const USER_ANDROID_APK_DOWNLOAD_URL = ANDROID_APP_DOWNLOAD_URL

/** 설계사용 ONE FC iOS — App Store 공개 링크 (TestFlight 미사용) */
export const ONE_FC_APP_STORE_URL = 'https://apps.apple.com/app/one-fc/id6785336968'

/** @deprecated ANDROID_APP_DOWNLOAD_URL 사용 */
export const MOBILE_DOWNLOAD_URL = ANDROID_APP_DOWNLOAD_URL
