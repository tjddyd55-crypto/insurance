export const CUSTOMER_MAP_MAX_MARKERS = 20

export const CUSTOMER_STATIC_MAP_WIDTH = 640
export const CUSTOMER_STATIC_MAP_HEIGHT = 400

/**
 * @returns {'static' | 'dynamic'}
 */
export function resolveMapRenderMode() {
  const mode = String(process.env.MAP_RENDER_MODE ?? 'dynamic').trim().toLowerCase()
  return mode === 'static' ? 'static' : 'dynamic'
}

/**
 * @returns {string}
 */
export function resolveMapProvider() {
  return String(process.env.MAP_PROVIDER ?? 'naver').trim().toLowerCase()
}
