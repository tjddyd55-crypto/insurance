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

export function navigateToCustomerOnMap(
  navigate: NavigateFunction,
  customerId: number,
  options?: { zoom?: number },
): void {
  navigate(buildCustomerMapFocusPath(customerId, options))
}
