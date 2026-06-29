/**
 * 출시 초기 무료 운영(App Store 3.1.1) — 결제·할인·쿠폰 UI 숨김.
 * 네이티브 앱 UA/ injected flag 없이 Vite env 만으로 제어한다.
 */
export function isFreeLaunchBillingUiHidden(): boolean {
  return String(import.meta.env.VITE_FREE_LAUNCH_HIDE_BILLING_UI ?? '').trim().toLowerCase() === 'true'
}
