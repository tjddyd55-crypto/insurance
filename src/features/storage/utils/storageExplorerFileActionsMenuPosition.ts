export type FloatingMenuSize = {
  width: number
  height: number
}

export type FloatingMenuPlacement = 'bottom' | 'top'

export type FloatingMenuPosition = {
  top: number
  left: number
  placement: FloatingMenuPlacement
}

type ResolveFloatingMenuPositionInput = {
  triggerRect: DOMRectReadOnly
  menuSize: FloatingMenuSize
  viewportWidth: number
  viewportHeight: number
  gap?: number
  viewportPadding?: number
}

/** Storage explorer compact action menu — viewport 기준 fixed 위치 (portal). */
export function resolveStorageExplorerFileActionsMenuPosition(
  input: ResolveFloatingMenuPositionInput,
): FloatingMenuPosition {
  const gap = input.gap ?? 4
  const viewportPadding = input.viewportPadding ?? 12
  const { triggerRect, menuSize, viewportWidth, viewportHeight } = input

  let left = triggerRect.right - menuSize.width
  if (left < viewportPadding) {
    left = viewportPadding
  }
  const maxLeft = viewportWidth - viewportPadding - menuSize.width
  if (left > maxLeft) {
    left = Math.max(viewportPadding, maxLeft)
  }

  const spaceBelow = viewportHeight - triggerRect.bottom - viewportPadding
  const spaceAbove = triggerRect.top - viewportPadding
  const placement: FloatingMenuPlacement =
    spaceBelow >= menuSize.height + gap || spaceBelow >= spaceAbove ? 'bottom' : 'top'

  const top =
    placement === 'bottom'
      ? triggerRect.bottom + gap
      : Math.max(viewportPadding, triggerRect.top - menuSize.height - gap)

  return { top, left, placement }
}
