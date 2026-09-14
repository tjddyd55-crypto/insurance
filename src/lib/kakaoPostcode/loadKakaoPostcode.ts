/**
 * 카카오(다음) 우편번호 서비스 스크립트 로더.
 *
 * 설계 의도:
 *   - 스크립트는 어플리케이션 전체에서 "있으면 재사용, 없으면 한 번만 주입" 되어야 한다.
 *   - 실패한 script element 는 제거하고 promise 를 reset 해 재시도가 가능해야 한다.
 *   - 동시 호출은 동일 Promise 를 공유한다.
 *
 * 외부 의존:
 *   - 카카오 공식 CDN: https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js
 *   - 로드 후 `window.kakao.Postcode` 또는 `window.daum.Postcode` 생성자를 노출한다.
 */

const POSTCODE_SRC = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
const SCRIPT_ID = 'insurance-kakao-postcode-script'
const STATE_ATTR = 'data-kakao-postcode-state'
const LOAD_TIMEOUT_MS = 20_000

export type PostcodeLoadState = 'idle' | 'loading' | 'loaded' | 'failed'

/**
 * 다음(카카오) Postcode `oncomplete` 콜백 인자. 공식 문서 항목 중 우리가 실제로 사용하는 것만 선언.
 */
export interface DaumPostcodeData {
  zonecode: string
  addressType: 'R' | 'J'
  address: string
  roadAddress: string
  jibunAddress: string
  buildingName?: string
  apartment?: 'Y' | 'N'
  bname?: string
}

export interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void
  onclose?: (state: 'FORCE_CLOSE' | 'COMPLETE_CLOSE') => void
  width?: string | number
  height?: string | number
}

export interface DaumPostcodeInstance {
  open(): void
  embed(element: HTMLElement): void
}

export type DaumPostcodeConstructor = new (options: DaumPostcodeOptions) => DaumPostcodeInstance

declare global {
  interface Window {
    daum?: {
      Postcode: DaumPostcodeConstructor
    }
    kakao?: {
      Postcode?: DaumPostcodeConstructor
    }
  }
}

let loadingPromise: Promise<DaumPostcodeConstructor> | null = null

function resolvePostcodeConstructor(): DaumPostcodeConstructor | null {
  return window.kakao?.Postcode ?? window.daum?.Postcode ?? null
}

function findManagedScript(): HTMLScriptElement | null {
  return document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
}

function removeStalePostcodeScripts(): void {
  const managed = findManagedScript()
  if (managed?.getAttribute(STATE_ATTR) === 'failed') {
    managed.remove()
  }

  document.querySelectorAll('script[src*="postcode.v2.js"]').forEach((node) => {
    const script = node as HTMLScriptElement
    if (script.id === SCRIPT_ID) return
    const state = script.getAttribute(STATE_ATTR)
    if (!state || state === 'failed') {
      script.remove()
    }
  })
}

/** 테스트/재시도용 — 실패한 script 와 in-flight promise 를 비운다. */
export function resetKakaoPostcodeLoader(): void {
  loadingPromise = null
  removeStalePostcodeScripts()
}

export function getKakaoPostcodeLoadState(): PostcodeLoadState {
  if (resolvePostcodeConstructor()) return 'loaded'
  const script = findManagedScript()
  const state = script?.getAttribute(STATE_ATTR)
  if (state === 'loading' || state === 'loaded' || state === 'failed') {
    return state
  }
  if (loadingPromise) return 'loading'
  return 'idle'
}

function rejectAndReset(reject: (error: Error) => void, message: string): void {
  loadingPromise = null
  reject(new Error(message))
}

function attachToInflightScript(
  script: HTMLScriptElement,
  resolve: (ctor: DaumPostcodeConstructor) => void,
  reject: (error: Error) => void,
): void {
  const onLoad = () => {
    const ctor = resolvePostcodeConstructor()
    if (ctor) {
      script.setAttribute(STATE_ATTR, 'loaded')
      resolve(ctor)
      return
    }
    script.setAttribute(STATE_ATTR, 'failed')
    script.remove()
    rejectAndReset(reject, 'kakao-postcode: 스크립트는 로드되었으나 Postcode 생성자를 찾지 못했습니다.')
  }

  const onError = () => {
    script.setAttribute(STATE_ATTR, 'failed')
    script.remove()
    rejectAndReset(reject, 'kakao-postcode: 스크립트 로드에 실패했습니다.')
  }

  if (resolvePostcodeConstructor()) {
    onLoad()
    return
  }

  script.addEventListener('load', onLoad, { once: true })
  script.addEventListener('error', onError, { once: true })
}

function injectPostcodeScript(
  resolve: (ctor: DaumPostcodeConstructor) => void,
  reject: (error: Error) => void,
): void {
  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = POSTCODE_SRC
  script.async = true
  script.setAttribute(STATE_ATTR, 'loading')

  const timeoutId = window.setTimeout(() => {
    script.setAttribute(STATE_ATTR, 'failed')
    script.remove()
    rejectAndReset(reject, 'kakao-postcode: 스크립트 로드 시간이 초과되었습니다.')
  }, LOAD_TIMEOUT_MS)

  const clearTimer = () => {
    window.clearTimeout(timeoutId)
  }

  script.addEventListener(
    'load',
    () => {
      clearTimer()
      const ctor = resolvePostcodeConstructor()
      if (ctor) {
        script.setAttribute(STATE_ATTR, 'loaded')
        resolve(ctor)
        return
      }
      script.setAttribute(STATE_ATTR, 'failed')
      script.remove()
      rejectAndReset(
        reject,
        'kakao-postcode: 스크립트는 로드되었으나 Postcode 생성자를 찾지 못했습니다.',
      )
    },
    { once: true },
  )

  script.addEventListener(
    'error',
    () => {
      clearTimer()
      script.setAttribute(STATE_ATTR, 'failed')
      script.remove()
      rejectAndReset(reject, 'kakao-postcode: 스크립트 로드에 실패했습니다.')
    },
    { once: true },
  )

  document.head.appendChild(script)
}

/**
 * 카카오(다음) 우편번호 생성자를 얻는다. 이미 로드되어 있으면 즉시 반환.
 */
export function loadKakaoPostcode(): Promise<DaumPostcodeConstructor> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('kakao-postcode: 브라우저 환경이 아닙니다.'))
  }

  const existingCtor = resolvePostcodeConstructor()
  if (existingCtor) {
    return Promise.resolve(existingCtor)
  }

  if (loadingPromise) {
    return loadingPromise
  }

  loadingPromise = new Promise<DaumPostcodeConstructor>((resolve, reject) => {
    removeStalePostcodeScripts()

    const inflight = findManagedScript()
    if (inflight?.getAttribute(STATE_ATTR) === 'loading') {
      attachToInflightScript(inflight, resolve, reject)
      return
    }

    injectPostcodeScript(resolve, reject)
  })

  loadingPromise.catch(() => {
    loadingPromise = null
  })

  return loadingPromise
}
