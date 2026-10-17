/** 주소창 등 작은 visualViewport 변화는 키보드로 보지 않는다. */
export const KEYBOARD_OPEN_THRESHOLD_PX = 80

export const FOCUSED_FIELD_PADDING_PX = 12

export function isKeyboardOpen(
  layoutHeight: number,
  visualHeight: number,
  thresholdPx = KEYBOARD_OPEN_THRESHOLD_PX,
): boolean {
  return layoutHeight - visualHeight > thresholdPx
}

/**
 * 필드가 usable 영역 밖에 있을 때만 필요한 scroll 거리.
 * 이미 보이면 0. scrollIntoView 는 쓰지 않는다.
 */
export function focusedFieldScrollDelta(params: {
  fieldTop: number
  fieldBottom: number
  visibleTop: number
  visibleBottom: number
}): number {
  const { fieldTop, fieldBottom, visibleTop, visibleBottom } = params
  if (fieldTop >= visibleTop && fieldBottom <= visibleBottom) return 0
  if (fieldBottom > visibleBottom) return fieldBottom - visibleBottom
  return fieldTop - visibleTop
}

/** 키보드가 닫혀 footer 가 화면을 가리면 그 위를 usable bottom 으로 쓴다. */
export function focusedFieldUsableBottom(params: {
  viewportOffsetTop: number
  viewportHeight: number
  keyboardOpen: boolean
  footerTop: number | null
  paddingPx?: number
}): number {
  const paddingPx = params.paddingPx ?? FOCUSED_FIELD_PADDING_PX
  const viewportBottom = params.viewportOffsetTop + params.viewportHeight
  if (!params.keyboardOpen && params.footerTop != null) {
    return Math.min(viewportBottom, params.footerTop) - paddingPx
  }
  return viewportBottom - paddingPx
}

export function ensureFocusedFieldVisible(
  scrollRoot: HTMLElement,
  field: HTMLElement,
  usable: { visibleTop: number; visibleBottom: number },
): number {
  const rect = field.getBoundingClientRect()
  const delta = focusedFieldScrollDelta({
    fieldTop: rect.top,
    fieldBottom: rect.bottom,
    visibleTop: usable.visibleTop,
    visibleBottom: usable.visibleBottom,
  })
  if (delta !== 0) scrollRoot.scrollTop += delta
  return delta
}
