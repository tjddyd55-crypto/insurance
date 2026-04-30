/**
 * 고객앱 [닫기]: 뒤로가기 금지. WebView 브릿지 → window.close() 순으로 시도한다.
 */

type WebKitHandler = { postMessage?: (message: unknown) => void }

function tryPostWebKitHandler(handler: WebKitHandler | undefined): boolean {
  if (!handler || typeof handler.postMessage !== 'function') {
    return false
  }
  try {
    handler.postMessage({ action: 'close' })
    return true
  } catch {
    try {
      handler.postMessage(null)
      return true
    } catch {
      return false
    }
  }
}

export function tryCloseCustomerApp(): void {
  const w = window as Window & {
    ReactNativeWebView?: { postMessage: (message: string) => void }
    Android?: { closeApp?: () => void }
  }

  try {
    if (w.ReactNativeWebView && typeof w.ReactNativeWebView.postMessage === 'function') {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLOSE_APP' }))
      return
    }
  } catch {
    // fall through
  }

  try {
    if (w.Android && typeof w.Android.closeApp === 'function') {
      w.Android.closeApp()
      return
    }
  } catch {
    // fall through
  }

  try {
    const raw = window.webkit?.messageHandlers
    const handlers = raw as Record<string, WebKitHandler> | undefined
    if (handlers && typeof handlers === 'object') {
      for (const name of ['closeApp', 'appClose', 'closeWebView']) {
        if (tryPostWebKitHandler(handlers[name])) {
          return
        }
      }
    }
  } catch {
    // fall through
  }

  try {
    window.close()
  } catch {
    /* noop — 인앱 브라우저 등에서 닫기 불가할 수 있음 */
  }
}
