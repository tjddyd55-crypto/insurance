/** 최신 공개 PC 설치 파일 — GitHub Release v1.0.309 (2026-10-25). 기존 CDN 설치 파일은 1.0.297(2026-06-20)로 오래됨. */
export const DESKTOP_DOWNLOAD_URL =
  'https://github.com/tjddyd55-crypto/insurance/releases/download/v1.0.309/ONE-FC-Setup-1.0.309.exe'

/**
 * 설계사용 ONE FC Android — Google Play 정식 상세 페이지 (SSOT).
 * 로그인·소개/설치 등 사용자 노출 Android 다운로드는 이 상수만 사용한다.
 */
export const ANDROID_APP_DOWNLOAD_URL =
  'https://play.google.com/store/apps/details?id=com.onefc.app'

/** @deprecated ANDROID_APP_DOWNLOAD_URL 사용 */
export const USER_ANDROID_APK_DOWNLOAD_URL = ANDROID_APP_DOWNLOAD_URL

/**
 * 설계사용 ONE FC iOS — App Store 공개 링크 (TestFlight 미사용).
 * 국가 코드(/kr/)가 없는 App Store 경로(app/one-fc/id…)는 데스크톱 브라우저에서 404가 난다.
 */
export const ONE_FC_APP_STORE_URL = 'https://apps.apple.com/kr/app/one-fc/id6785336968'

/** @deprecated ANDROID_APP_DOWNLOAD_URL 사용 */
export const MOBILE_DOWNLOAD_URL = ANDROID_APP_DOWNLOAD_URL
