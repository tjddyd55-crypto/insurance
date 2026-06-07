type NaverAuthFailureListener = () => void

let naverAuthFailed = false
const listeners = new Set<NaverAuthFailureListener>()

export function wasNaverMapAuthFailure(): boolean {
  return naverAuthFailed
}

export function onNaverMapAuthFailure(listener: NaverAuthFailureListener): () => void {
  listeners.add(listener)
  if (naverAuthFailed) {
    listener()
  }
  return () => {
    listeners.delete(listener)
  }
}

function notifyNaverMapAuthFailure(clientKeyLength: number): void {
  if (naverAuthFailed) {
    return
  }
  naverAuthFailed = true
  console.error('[customer-map] navermap_authFailure', {
    clientIdLength: clientKeyLength,
    origin: window.location.origin,
    referrer: document.referrer || '(empty)',
  })
  for (const listener of listeners) {
    listener()
  }
}

/**
 * NAVER 지도 API v3 문서: SDK 로드 전 window.navermap_authFailure 를 등록한다.
 * 기존 handler 가 있으면 wrapper 로 호출을 보존한다.
 */
export function installNaverMapAuthFailureHandler(clientKeyLength: number): void {
  const previous = window.navermap_authFailure
  window.navermap_authFailure = function insuranceCustomerMapAuthFailure() {
    notifyNaverMapAuthFailure(clientKeyLength)
    if (typeof previous === 'function' && previous !== insuranceCustomerMapAuthFailure) {
      try {
        previous()
      } catch {
        // 외부 handler 실패는 무시
      }
    }
  }
}

declare global {
  interface Window {
    navermap_authFailure?: () => void
  }
}
