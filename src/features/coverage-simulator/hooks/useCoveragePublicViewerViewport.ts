import { useEffect } from 'react'

const DEFAULT_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1'
const PINCH_ZOOM_VIEWPORT = 'width=device-width, initial-scale=1'

/**
 * 공유 URL 등 브라우저 pinch zoom이 필요한 뷰어에서 index.html의 maximum-scale=1을 일시 해제한다.
 */
export function useCoveragePublicViewerViewport(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    const meta = document.querySelector('meta[name="viewport"]')
    if (!meta) return undefined
    const previous = meta.getAttribute('content') ?? DEFAULT_VIEWPORT
    meta.setAttribute('content', PINCH_ZOOM_VIEWPORT)
    return () => {
      meta.setAttribute('content', previous)
    }
  }, [enabled])
}
