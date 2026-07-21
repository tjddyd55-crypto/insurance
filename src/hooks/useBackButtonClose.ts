import { useEffect, useId, useRef } from 'react'

import {
  buildUiLayerPushState,
  isOwnUiLayerTop,
  shouldPopSyntheticEntryOnDismiss,
} from './backButtonCloseHistory'

export type UseBackButtonCloseOptions = {
  /**
   * history.state.__uiLayer 값. 모달/드로어 종류 식별.
   * 기본 'ui-layer'. 고객앱 연결 모달은 'customer-app-link-modal'.
   */
  layerKind?: string
}

/**
 * "열린 UI 레이어"(드로어/모달/바텀시트 등) 를 브라우저 뒤로가기(또는 Android 하드웨어 back)
 * 로 닫게 해 주는 공용 훅.
 *
 * 동작:
 *   1. isOpen === true 로 진입하면 history.pushState 로 가짜 히스토리 1개를 쌓는다.
 *   2. 뒤로가기(popstate) 가 오면 onClose() 만 호출한다. 추가 history.back() 금지.
 *   3. X/취소로 isOpen 이 false 가 되면, top marker 가 내 것일 때만 history.back() 으로 정리.
 *   4. insurance-before-global-back(네이티브 bridge) 도 가로채 모달만 닫는다.
 *
 * BaseDialog closeOnHistoryBack 과 같은 모달에 중복 적용하지 말 것.
 */
export function useBackButtonClose(
  isOpen: boolean,
  onClose: () => void,
  options?: UseBackButtonCloseOptions,
): void {
  const layerId = useId()
  const layerKind = options?.layerKind ?? 'ui-layer'

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const pushedRef = useRef(false)
  /** popstate 로 이미 닫는 중이면 cleanup 의 history.back() 을 건너뛴다. */
  const closedByPopRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (!isOpen) {
      return
    }

    closedByPopRef.current = false
    const nextState = buildUiLayerPushState(window.history.state, layerKind, layerId)
    window.history.pushState(nextState, '', window.location.href)
    pushedRef.current = true

    const onPopState = () => {
      if (!pushedRef.current) {
        return
      }
      pushedRef.current = false
      closedByPopRef.current = true
      onCloseRef.current()
    }

    const onBeforeGlobalBack = (event: Event) => {
      if (!pushedRef.current) {
        return
      }
      event.preventDefault()
      const top = window.history.state
      if (isOwnUiLayerTop(top, layerKind, layerId)) {
        // history.back → popstate → onPopState 가 onClose 1회 호출
        window.history.back()
        return
      }
      pushedRef.current = false
      closedByPopRef.current = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('insurance-before-global-back', onBeforeGlobalBack)

    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('insurance-before-global-back', onBeforeGlobalBack)

      if (closedByPopRef.current) {
        closedByPopRef.current = false
        pushedRef.current = false
        return
      }

      const shouldPop = shouldPopSyntheticEntryOnDismiss({
        pushed: pushedRef.current,
        top: window.history.state,
        layerKind,
        layerId,
        historyLength: window.history.length,
      })
      pushedRef.current = false
      if (!shouldPop) {
        return
      }
      window.history.back()
    }
  }, [isOpen, layerId, layerKind])
}
