/** 브라우저 POP / 뒤로 버튼에서 공통으로 쓰는 뒤로가기 확인 정책 */

export const MSG_CUSTOMER_CREATE_EXIT = '고객 등록을 중지하시겠습니까?'
export const MSG_APPLICATION_WRITE_EXIT = '자동차 신청 작성을 중지하시겠습니까?'
export const MSG_APP_EXIT = '앱을 종료하시겠습니까?'

export type BackNavigationBlock = {
  shouldBlock: boolean
  message: string
}

/** 자동차보험 신청서 메인 허브(뒤로 UI 시 메인 메뉴로 고정 이동) */
export function isCarInsuranceMainHub(pathname: string): boolean {
  return pathname === '/application'
}

/**
 * POP / PageBackButton 확인 모달이 필요한 경우만 true.
 * - 메인 메뉴(/dashboard)만 앱 종료 확인
 * - /customers + mode=create 만 등록 중지 확인
 * - /application/write 만 신청 작성 중지 확인
 */
export function getBackNavigationBlock(pathname: string, search: string): BackNavigationBlock {
  const path = pathname

  if (path === '/dashboard') {
    return { shouldBlock: true, message: MSG_APP_EXIT }
  }

  if (path.startsWith('/customers') && search.includes('mode=create')) {
    return { shouldBlock: true, message: MSG_CUSTOMER_CREATE_EXIT }
  }

  if (path.startsWith('/application/write')) {
    return { shouldBlock: true, message: MSG_APPLICATION_WRITE_EXIT }
  }

  return { shouldBlock: false, message: '' }
}
