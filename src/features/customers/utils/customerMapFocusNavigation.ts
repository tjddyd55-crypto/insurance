import type { NavigateFunction } from 'react-router-dom'
import { CUSTOMER_MAP_FOCUS_ZOOM } from '../config/customerMap.config'

export const FOCUS_CUSTOMER_ID_QUERY_KEY = 'focusCustomerId'
export const FOCUS_ZOOM_QUERY_KEY = 'zoom'

export const CUSTOMER_MAP_FOCUS_UNAVAILABLE_MESSAGE =
  '이 고객은 아직 좌표 변환이 완료되지 않아 지도에서 표시할 수 없습니다.'

export function parseFocusCustomerId(raw: string | null | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function parseFocusZoom(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') {
    return null
  }
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 && n <= 19 ? Math.round(n) : null
}

/** 고객 상세 작업영역 지도 탭 — 좌측 목록 유지 */
export function buildCustomerDetailMapPath(customerId: number): string {
  return `/customers/${customerId}/map`
}

/**
 * 메뉴「고객 지도」전체 화면에서 특정 고객으로 포커스할 때 사용.
 * 고객 상세「지도에서 보기」는 `buildCustomerDetailMapPath` 를 쓴다.
 */
export function buildCustomerMapFocusPath(
  customerId: number,
  options?: { zoom?: number },
): string {
  const params = new URLSearchParams()
  params.set(FOCUS_CUSTOMER_ID_QUERY_KEY, String(customerId))
  const zoom = options?.zoom ?? CUSTOMER_MAP_FOCUS_ZOOM
  if (Number.isFinite(zoom)) {
    params.set(FOCUS_ZOOM_QUERY_KEY, String(zoom))
  }
  return `/customers/map?${params.toString()}`
}

/** 고객 상세 우측 패널 지도 탭으로 이동 (워크스페이스 유지) */
export function navigateToCustomerOnMap(
  navigate: NavigateFunction,
  customerId: number,
  _options?: { zoom?: number },
): void {
  navigate(buildCustomerDetailMapPath(customerId))
}

/** 메뉴 전체 지도에서 focusCustomerId 로 진입할 때 */
export function navigateToCustomerMapOverviewFocus(
  navigate: NavigateFunction,
  customerId: number,
  options?: { zoom?: number },
): void {
  navigate(buildCustomerMapFocusPath(customerId, options))
}
