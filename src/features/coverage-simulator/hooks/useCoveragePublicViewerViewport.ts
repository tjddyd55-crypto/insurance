import { useEffect } from 'react'

const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1'
const PINCH_ZOOM_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'

function stripViewportZoomLocks(content: string): string {
  return content
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^maximum-scale=/i.test(part) && !/^user-scalable=/i.test(part))
    .join(', ')
}

/**
 * 공유 URL 등 브라우저 pinch zoom이 필요한 뷰어에서 index.html의 maximum-scale=1을 일시 해제한다.
 */
export function useCoveragePublicViewerViewport(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const meta = document.querySelector('meta[name="viewport"]')
    if (!meta) return undefined
    const previous = meta.getAttribute('content') ?? DEFAULT_VIEWPORT
    const unlocked = stripViewportZoomLocks(previous)
    meta.setAttribute(
      'content',
      unlocked.includes('width=device-width') ? unlocked : PINCH_ZOOM_VIEWPORT,
    )
    return () => {
      meta.setAttribute('content', previous)
    }
  }, [enabled])
}
