import {
  CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX,
  CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX,
  CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX,
} from '../config/customerRecentRegistration.config'

export type CustomerListVisibleRect = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export type CustomerListFabPositionStyle = {
  position: 'fixed'
  left: number
  top: number
  transform: 'translateX(-50%)'
  zIndex: number
  visibility: 'visible'
}

/**
 * 리스트 DOM rect 와 viewport 의 교집합 (화면에 실제로 보이는 리스트 영역).
 * width/height ≤ 0 이면 null.
 */
export function computeVisibleListRect(
  listRect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  viewport: { width: number; height: number },
): CustomerListVisibleRect | null {
  const left = Math.max(listRect.left, 0)
  const right = Math.min(listRect.right, viewport.width)
  const top = Math.max(listRect.top, 0)
  const bottom = Math.min(listRect.bottom, viewport.height)
  const width = right - left
  const height = bottom - top
  if (!(width > 0) || !(height > 0)) {
    return null
  }
  return { left, right, top, bottom, width, height }
}

/**
 * PC/Mobile 공통: visible list rect 하단 중앙.
 * - centerX = visibleLeft + visibleWidth / 2 (FAB 전체가 visible 안에 있도록 clamp)
 * - top = visibleBottom - fabHeight - bottomInset (viewport 안으로 clamp)
 * right-inset / workspace-right / viewport 전체 중앙 기준 금지.
 */
export function computeCustomerListFabFixedPosition(params: {
  containerRect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>
  viewportWidth: number
  viewportHeight: number
  fabWidth?: number
  fabHeight?: number
  bottomOffset?: number
}): CustomerListFabPositionStyle | null {
  const {
    containerRect,
    viewportWidth,
    viewportHeight,
    fabWidth = CUSTOMER_LIST_SCROLL_FAB_WIDTH_PX,
    fabHeight = CUSTOMER_LIST_SCROLL_FAB_HEIGHT_PX,
    bottomOffset = CUSTOMER_LIST_SCROLL_FAB_BOTTOM_OFFSET_PX,
  } = params

  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    return null
  }
  if (!(fabWidth > 0) || !(fabHeight > 0)) {
    return null
  }

  const visible = computeVisibleListRect(containerRect, {
    width: viewportWidth,
    height: viewportHeight,
  })
  if (!visible) {
    return null
  }

  const halfW = fabWidth / 2
  let centerX = visible.left + visible.width / 2
  const minCenter = visible.left + halfW
  const maxCenter = visible.right - halfW
  if (minCenter <= maxCenter) {
    centerX = Math.min(maxCenter, Math.max(minCenter, centerX))
  } else {
    // visible 폭이 FAB 보다 좁아도 가운데 유지 (초협폭에서도 숨기지 않음)
    centerX = visible.left + visible.width / 2
  }
  // viewport 밖으로 FAB 일부가 나가지 않도록 최종 clamp
  centerX = Math.min(viewportWidth - halfW, Math.max(halfW, centerX))

  let top = visible.bottom - fabHeight - bottomOffset
  top = Math.min(top, viewportHeight - fabHeight)
  top = Math.max(0, top)

  return {
    position: 'fixed',
    left: Math.round(centerX),
    top: Math.round(top),
    transform: 'translateX(-50%)',
    zIndex: 50,
    visibility: 'visible',
  }
}
