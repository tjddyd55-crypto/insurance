/** 브라우저 POP / 뒤로 버튼 확인 — 단일 진실 원천 */

export const MSG_CUSTOMER_CREATE_EXIT = '고객 등록을 취소하시겠습니까?'
export const MSG_APPLICATION_WRITE_EXIT = '자동차 신청 작성을 중지하시겠습니까?'
export const MSG_APP_EXIT = '앱을 종료하시겠습니까?'

export type BackNavigationBlock = {
  shouldBlock: boolean
  message: string
}

/** 자동차보험 신청서 메인(UI 뒤로는 히스토리 대신 메인 메뉴로) */
export function isCarInsuranceMainHub(pathname: string): boolean {
  return pathname === '/application'
}

/**
 * useBlocker(POP): 아래 세 경우만 확인.
 * 그 외 path는 shouldBlock === false (조회·/application 등 그뒤로 이동만).
 */
export function getBackNavigationBlock(pathname: string, search: string): BackNavigationBlock {
  const path = pathname
  let shouldBlock = false
  let message = ''

  if (path === '/dashboard') {
    shouldBlock = true
    message = MSG_APP_EXIT
  }

  if (path.startsWith('/customers') && search.includes('mode=create')) {
    shouldBlock = true
    message = MSG_CUSTOMER_CREATE_EXIT
  }

  if (path.startsWith('/application/write')) {
    shouldBlock = true
    message = MSG_APPLICATION_WRITE_EXIT
  }

  return { shouldBlock, message }
}
