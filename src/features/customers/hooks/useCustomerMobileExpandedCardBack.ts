import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'

import { isCustomerWorkspaceSideDetailPath } from '../utils/customerWorkspaceNavigation'

const CUSTOMER_LIST_PATH_RE = /^\/customers\/?$/

type MobileCustomerModal = null | 'files' | 'consultations' | 'ga' | 'signatures'

type Params = {
  isMobile: boolean
  pathname: string
  expandedId: number | null
  activeMobileModal: MobileCustomerModal
  setExpandedId: Dispatch<SetStateAction<number | null>>
  clearMobileModal: () => void
}

/**
 * 모바일 고객 목록: 펼친 카드·작업 모달이 열린 상태에서 뒤로가기 시 라우트 이탈 대신 레이어만 닫는다.
 *
 * 우선순위: 작업 모달 → 펼친 카드 → (그 외) 전역 back handler.
 * PC 경로·사이드 상세 path 에서는 no-op.
 */
export function useCustomerMobileExpandedCardBack({
  isMobile,
  pathname,
  expandedId,
  activeMobileModal,
  setExpandedId,
  clearMobileModal,
}: Params): void {
  const expandedIdRef = useRef(expandedId)
  const activeMobileModalRef = useRef(activeMobileModal)
  const expandedHistoryPushedRef = useRef(false)
  const collapseFromPopstateRef = useRef(false)
  const clearMobileModalRef = useRef(clearMobileModal)

  expandedIdRef.current = expandedId
  activeMobileModalRef.current = activeMobileModal
  clearMobileModalRef.current = clearMobileModal

  const backHandlingEnabled =
    isMobile &&
    CUSTOMER_LIST_PATH_RE.test(pathname) &&
    !isCustomerWorkspaceSideDetailPath(pathname)

  useEffect(() => {
    if (!backHandlingEnabled || activeMobileModal != null) {
      return
    }
    if (expandedId == null || expandedHistoryPushedRef.current) {
      return
    }
    window.history.pushState({ customerListExpanded: true, customerId: expandedId }, '')
    expandedHistoryPushedRef.current = true
  }, [activeMobileModal, backHandlingEnabled, expandedId])

  useEffect(() => {
    if (!backHandlingEnabled) {
      return
    }
    if (expandedId != null) {
      return
    }
    if (!expandedHistoryPushedRef.current || collapseFromPopstateRef.current) {
      collapseFromPopstateRef.current = false
      return
    }
    const top = window.history.state as { customerListExpanded?: boolean } | null
    if (top?.customerListExpanded) {
      expandedHistoryPushedRef.current = false
      window.history.back()
    }
  }, [backHandlingEnabled, expandedId])

  useEffect(() => {
    if (!backHandlingEnabled) {
      return
    }

    const handlePopState = () => {
      if (activeMobileModalRef.current != null) {
        clearMobileModalRef.current()
        return
      }
      if (expandedIdRef.current == null) {
        return
      }
      /*
       * 모달(useBackButtonClose) 이 expanded entry 위에 쌓인 뒤 먼저 pop 되면
       * 남은 top 은 여전히 customerListExpanded 이다. 이 경우 카드는 유지한다.
       * expanded entry 자체가 pop 되어 top 에 마커가 없을 때만 접는다.
       */
      const top = window.history.state as { customerListExpanded?: boolean } | null
      if (top?.customerListExpanded) {
        return
      }
      collapseFromPopstateRef.current = true
      expandedHistoryPushedRef.current = false
      setExpandedId(null)
    }

    const handleBeforeGlobalBack = (event: Event) => {
      const top = window.history.state as {
        modal?: boolean
        customerListExpanded?: boolean
        __uiLayer?: string
        __BASE_DIALOG_BACK_TRAP__?: boolean
      } | null

      /*
       * 고객앱 연결 등 UI 레이어 trap 이 top 이면 전역/카드 핸들러는 양보한다.
       * (useBackButtonClose 가 같은 이벤트에서 preventDefault + close 처리)
       */
      if (top?.__uiLayer || top?.__BASE_DIALOG_BACK_TRAP__) {
        return
      }

      if (activeMobileModalRef.current != null) {
        event.preventDefault()
        if (top?.modal === true) {
          window.history.back()
        } else {
          clearMobileModalRef.current()
        }
        return
      }
      if (expandedIdRef.current == null) {
        return
      }
      event.preventDefault()
      if (expandedHistoryPushedRef.current && top?.customerListExpanded) {
        expandedHistoryPushedRef.current = false
        window.history.back()
        return
      }
      setExpandedId(null)
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('insurance-before-global-back', handleBeforeGlobalBack)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('insurance-before-global-back', handleBeforeGlobalBack)
    }
  }, [backHandlingEnabled, setExpandedId])
}
