import { CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX } from '../config/customerRecentRegistration.config'
import { resolveCustomerListScrollContainer } from './resolveCustomerListScrollContainer'

/** 상단 이동 FAB bottom offset — 리스트 스크롤 컨테이너 하단 중앙 기준 */
export function resolveCustomerListScrollFabBottomOffsetPx(panel: HTMLElement | null): number {
  if (!panel || !panel.isConnected) {
    return CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX
  }

  const container = resolveCustomerListScrollContainer(panel)
  if (!container) {
    return CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX
  }

  const rect = container.getBoundingClientRect()
  return Math.max(
    CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX,
    window.innerHeight - rect.bottom + CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX,
  )
}
