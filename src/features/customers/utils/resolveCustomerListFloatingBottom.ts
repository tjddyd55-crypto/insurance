import { CUSTOMER_LIST_FAB_BOTTOM_OFFSET_PX } from '../config/customerRecentRegistration.config'
import { resolveCustomerListScrollContainer } from './resolveCustomerListScrollContainer'

/** 모바일 플로팅 버튼(상단 이동·최근 등록) 공통 bottom offset — viewport fixed 기준 */
export function resolveCustomerListFloatingBottomOffsetPx(panel: HTMLElement | null): number {
  if (!panel || !panel.isConnected) {
    return CUSTOMER_LIST_FAB_BOTTOM_OFFSET_PX
  }

  const container = resolveCustomerListScrollContainer(panel)
  if (!container) {
    return CUSTOMER_LIST_FAB_BOTTOM_OFFSET_PX
  }

  const rect = container.getBoundingClientRect()
  return Math.max(
    CUSTOMER_LIST_FAB_BOTTOM_OFFSET_PX,
    window.innerHeight - rect.bottom + CUSTOMER_LIST_FAB_BOTTOM_OFFSET_PX,
  )
}
