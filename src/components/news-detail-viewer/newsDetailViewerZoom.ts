export const NEWS_DETAIL_VIEWER_ZOOM_MIN = 0.5
export const NEWS_DETAIL_VIEWER_ZOOM_MAX = 3
export const NEWS_DETAIL_VIEWER_ZOOM_STEP = 0.2

export function clampNewsDetailViewerZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1
  }
  return Math.min(NEWS_DETAIL_VIEWER_ZOOM_MAX, Math.max(NEWS_DETAIL_VIEWER_ZOOM_MIN, zoom))
}

export function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) {
    return 0
  }
  const first = touches[0]
  const second = touches[1]
  const dx = second.clientX - first.clientX
  const dy = second.clientY - first.clientY
  return Math.sqrt(dx * dx + dy * dy)
}
