/**
 * 공개 고객등록 링크 완료 화면 [닫기] — WebView·인앱 브라우저·일반 탭 순으로 시도한다.
 */

const CLOSE_FALLBACK_MESSAGE =
  '창을 닫을 수 없는 브라우저입니다. 브라우저의 뒤로가기 또는 닫기 버튼을 눌러 주세요.'

type ClosePublicCustomerRegistrationOptions = {
  onCannotClose?: () => void
}

export function getPublicCustomerRegistrationCloseFallbackMessage(): string {
  return CLOSE_FALLBACK_MESSAGE
}

export function closePublicCustomerRegistration(
  options: ClosePublicCustomerRegistrationOptions = {},
): void {
  const { onCannotClose } = options
  const w = window as Window & {
    ReactNativeWebView?: { postMessage: (message: string) => void }
    Android?: { closeApp?: () => void; closeWindow?: () => void }
  }

  if (typeof w.ReactNativeWebView?.postMessage === 'function') {
    try {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLOSE_CUSTOMER_REGISTER' }))
      return
    } catch {
      /* fall through */
    }
  }

  if (typeof w.Android?.closeApp === 'function') {
    w.Android.closeApp()
    return
  }
  if (typeof w.Android?.closeWindow === 'function') {
    w.Android.closeWindow()
    return
  }

  const ua = navigator.userAgent.toLowerCase()
  const isKakao = ua.includes('kakaotalk')
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isAndroid = ua.includes('android')

  if (isKakao) {
    if (isIOS) {
      window.location.href = 'kakaoweb://closeBrowser'
      window.setTimeout(() => onCannotClose?.(), 420)
      return
    }
    window.location.href = isAndroid ? 'kakaotalk://inappbrowser/close' : 'kakaotalk://inappbrowser/close'
    window.setTimeout(() => onCannotClose?.(), 420)
    return
  }

  try {
    window.close()
  } catch {
    onCannotClose?.()
    return
  }

  window.setTimeout(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
      onCannotClose?.()
    }
  }, 420)
}
