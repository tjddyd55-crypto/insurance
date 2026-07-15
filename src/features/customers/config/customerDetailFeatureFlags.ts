import { canAccessContractSignatureUserSend } from '../../contracts/testConsole/contractSignatureTestConsoleFlags'

/**
 * 고객 상세(우측 탭·모바일 액션) 기능 노출 게이트.
 * 대시보드 대분류 메뉴(`USER_MENU_FEATURE_FLAGS`)와 분리한다.
 * 라우트·API는 유지하고, 고객 작업영역 UI 노출·진입만 제어한다.
 */
export const CUSTOMER_DETAIL_FEATURE_FLAGS = {
  /** 고객 상세 「전자서명」 탭 / 모바일 액션 */
  electronicSignature: false,
} as const

/** 고객 작업영역에서 전자서명 탭·모달을 보여줄지 */
export function canShowCustomerDetailElectronicSignature(role: string | undefined): boolean {
  if (!CUSTOMER_DETAIL_FEATURE_FLAGS.electronicSignature) {
    return false
  }
  return canAccessContractSignatureUserSend(role)
}
