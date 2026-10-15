/** Facebook 랜딩 CTA·쿠폰 이벤트. 기존 dataLayer가 있으면 push만 한다. */
export type FacebookLandingAnalyticsEvent =
  | 'facebook_landing_view'
  | 'facebook_pc_start_click'
  | 'facebook_android_download_click'
  | 'facebook_ios_download_click'
  | 'facebook_coupon_copy'
  | 'facebook_signup_click'
  | 'facebook_free_start_click'
  | 'facebook_view_promo_click'

export function trackFacebookLandingEvent(event: FacebookLandingAnalyticsEvent): void {
  if (typeof window === 'undefined') {
    return
  }
  const w = window as Window & { dataLayer?: Array<Record<string, unknown>> }
  try {
    w.dataLayer?.push({ event })
  } catch {
    // analytics optional
  }
}
