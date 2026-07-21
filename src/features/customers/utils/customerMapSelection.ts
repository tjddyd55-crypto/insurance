/**
 * 고객 지도 마커 카드(선택 패널) selection SSOT 헬퍼.
 * 카드 open 여부는 selectedGroupKey / selectedCustomerId 로 파생된다.
 */

export type CustomerMapSelection = {
  selectedCustomerId: number | null
  selectedGroupKey: string | null
}

export function clearCustomerMapSelection(): CustomerMapSelection {
  return {
    selectedCustomerId: null,
    selectedGroupKey: null,
  }
}

export function isCustomerMapMarkerCardOpen(selection: CustomerMapSelection): boolean {
  return selection.selectedGroupKey != null || selection.selectedCustomerId != null
}

/**
 * path 상세 고객을 selection 으로 자동 복원해도 되는지.
 * 사용자가 카드를 닫은 뒤에는 false — effect 가 다시 열면 안 된다.
 */
export function shouldRestorePathCustomerSelection(input: {
  openDetailInWorkspaceMap: boolean
  pathCustomerId: number | null | undefined
  selectedCustomerId: number | null
  userDismissedMarkerCard: boolean
  pathCustomerHasValidMarker: boolean
}): boolean {
  if (!input.openDetailInWorkspaceMap) {
    return false
  }
  if (input.userDismissedMarkerCard) {
    return false
  }
  if (input.pathCustomerId == null || input.pathCustomerId <= 0) {
    return false
  }
  if (!input.pathCustomerHasValidMarker) {
    return false
  }
  if (input.selectedCustomerId != null) {
    return false
  }
  return true
}

/** 「고객 위치로 이동」시 카드가 이미 열려 있을 때만 selection 을 유지·갱신 */
export function shouldOpenMarkerCardOnRecenter(selection: CustomerMapSelection): boolean {
  return isCustomerMapMarkerCardOpen(selection)
}
