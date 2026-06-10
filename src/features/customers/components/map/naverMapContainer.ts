import { MapSdkError } from './mapSdkErrors'

/** NAVER 문서: 초기화 시점 DOM 크기가 0이면 지도 표시가 고정·깨질 수 있음 */
export const MIN_MAP_CONTAINER_HEIGHT_PX = 200

export function readContainerSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect()
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

export function hasUsableMapContainerSize(element: HTMLElement): boolean {
  const { width, height } = readContainerSize(element)
  return width > 0 && height >= MIN_MAP_CONTAINER_HEIGHT_PX
}

export function waitForUsableMapContainerSize(
  element: HTMLElement,
  timeoutMs = 8000,
): Promise<{ width: number; height: number }> {
  if (hasUsableMapContainerSize(element)) {
    return Promise.resolve(readContainerSize(element))
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const observer = new ResizeObserver(() => {
      if (hasUsableMapContainerSize(element)) {
        observer.disconnect()
        window.clearTimeout(timeoutId)
        resolve(readContainerSize(element))
      }
    })
    observer.observe(element)

    const timeoutId = window.setTimeout(() => {
      observer.disconnect()
      if (hasUsableMapContainerSize(element)) {
        resolve(readContainerSize(element))
        return
      }
      reject(new MapSdkError('map_init_failed'))
    }, timeoutMs)

    const poll = () => {
      if (hasUsableMapContainerSize(element)) {
        observer.disconnect()
        window.clearTimeout(timeoutId)
        resolve(readContainerSize(element))
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        return
      }
      window.requestAnimationFrame(poll)
    }
    poll()
  })
}
