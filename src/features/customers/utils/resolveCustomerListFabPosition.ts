import {
  CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX,
  CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX,
  CUSTOMER_LIST_SCROLL_FAB_RIGHT_OFFSET_PX,
  CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX,
} from '../config/customerRecentRegistration.config'

export type CustomerListFabPositionStyle = {
  position: 'fixed'
  left: number
  top: number
  transform?: string
  zIndex: number
  visibility: 'visible'
}

/**
 * PC: 리스트 scroll container 우측 하단.
 * Mobile: 컨테이너 하단 중앙 (기존 체감 유지).
 * window/page 기준 right 금지 — container.getBoundingClientRect() 만 사용.
 */
export function computeCustomerListFabFixedPosition(params: {
  containerRect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>
  variant: 'pc' | 'mobile'
  fabWidth?: number
  fabHeight?: number
  rightOffset?: number
  bottomOffset?: number
}): CustomerListFabPositionStyle | null {
  const {
    containerRect,
    variant,
    fabWidth = CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX,
    fabHeight = CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX,
    rightOffset = CUSTOMER_LIST_SCROLL_FAB_RIGHT_OFFSET_PX,
    bottomOffset = CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX,
  } = params

  if (containerRect.width < fabWidth || containerRect.height < fabHeight) {
    return null
  }

  const top = Math.round(containerRect.bottom - fabHeight - bottomOffset)

  if (variant === 'mobile') {
    return {
      position: 'fixed',
      left: Math.round(containerRect.left + containerRect.width / 2),
      top,
      transform: 'translateX(-50%)',
      zIndex: 50,
      visibility: 'visible',
    }
  }

  return {
    position: 'fixed',
    left: Math.round(containerRect.right - fabWidth - rightOffset),
    top,
    zIndex: 50,
    visibility: 'visible',
  }
}
