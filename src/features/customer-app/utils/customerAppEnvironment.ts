/**
 * 고객앱이 설계사 웹(PC 브라우저)이 아니라 **네이티브 고객앱 WebView** 안에서
 * 실행 중인지 판별한다. 닫기 UX·안내 문구 분기에 사용한다.
 */

export function isCustomerAppNativeWebView(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const w = window as Window & { ReactNativeWebView?: { postMessage?: (msg: string) => void } }
  if (w.ReactNativeWebView && typeof w.ReactNativeWebView.postMessage === 'function') {
    return true
  }
  try {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('appWebView') === '1') {
      return true
    }
  } catch {
    /* noop */
  }
  return false
}
