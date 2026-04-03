/** 브라우저 POP / 뒤로 버튼에서 공통으로 쓰는 뒤로가기 확인 정책 */

export const MSG_CUSTOMER_CREATE_EXIT = '고객 등록을 중지하시겠습니까?'
export const MSG_APPLICATION_WRITE_EXIT = '자동차 신청 작성을 중지하시겠습니까?'
export const MSG_APP_EXIT = '앱을 종료하시겠습니까?'

export type BackNavigationBlock = {
  shouldBlock: boolean
  message: string
}

function customerModeFromSearch(search: string): 'create' | 'list' {
  const q = search.startsWith('?') ? search.slice(1) : search
  return new URLSearchParams(q).get('mode') === 'create' ? 'create' : 'list'
}

function isApplicationFormEditPath(pathname: string): boolean {
  return /^\/form\/[^/]+\/edit$/.test(pathname)
}

function isApplicationReadOnly(search: string): boolean {
  const q = search.startsWith('?') ? search.slice(1) : search
  return new URLSearchParams(q).get('mode') === 'readonly'
}

/**
 * 현재 URL 기준으로 뒤로 이동(POP) 전 사용자 확인이 필요한지 판별합니다.
 * - 고객 목록(조회): 차단 없음
 * - 고객 등록(mode=create): 등록 중지 확인
 * - 신청서 작성(/application/write, /form/create, 편집 모드 /form/:id/edit): 작성 중지 확인 (readonly 제외)
 * - 메인 허브(/dashboard, /application, /menu, /menu/car-insurance): 앱 종료 확인
 */
export function getBackNavigationBlock(pathname: string, search: string): BackNavigationBlock {
  const path = pathname

  if (path.startsWith('/customers')) {
    if (customerModeFromSearch(search) === 'list') {
      return { shouldBlock: false, message: '' }
    }
    return { shouldBlock: true, message: MSG_CUSTOMER_CREATE_EXIT }
  }

  if (path.startsWith('/application/write')) {
    return { shouldBlock: true, message: MSG_APPLICATION_WRITE_EXIT }
  }

  if (path === '/form/create') {
    return { shouldBlock: true, message: MSG_APPLICATION_WRITE_EXIT }
  }

  if (isApplicationFormEditPath(path) && !isApplicationReadOnly(search)) {
    return { shouldBlock: true, message: MSG_APPLICATION_WRITE_EXIT }
  }

  if (
    path === '/dashboard' ||
    path === '/menu' ||
    path === '/application' ||
    path === '/menu/car-insurance'
  ) {
    return { shouldBlock: true, message: MSG_APP_EXIT }
  }

  return { shouldBlock: false, message: '' }
}
