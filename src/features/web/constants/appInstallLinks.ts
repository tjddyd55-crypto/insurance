const DOWNLOAD_CACHE_BUST = 'v=1781884175110-desktop-6479384'

export const DESKTOP_DOWNLOAD_URL = `https://cdn.platform-assets.com/insurance/download/one-fc-pc.exe?${DOWNLOAD_CACHE_BUST}`

/** 설계사용 ONE FC Android APK — R2: insurance/download/one-fc-user.apk */
export const USER_ANDROID_APK_DOWNLOAD_URL = `https://cdn.platform-assets.com/insurance/download/one-fc-user.apk?${DOWNLOAD_CACHE_BUST}`

/** 설계사용 ONE FC iOS — App Store 공개 링크 (TestFlight 미사용) */
export const ONE_FC_APP_STORE_URL = 'https://apps.apple.com/app/one-fc/id6785336968'

/** @deprecated USER_ANDROID_APK_DOWNLOAD_URL 사용 */
export const MOBILE_DOWNLOAD_URL = USER_ANDROID_APK_DOWNLOAD_URL
