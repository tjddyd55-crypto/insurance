/** 네이티브 뷰어가 쓰는 페이지 이미지 너비. 임의 픽셀은 버킷으로 모아 캐시가 재사용되게 한다. */
export const BINDER_PAGE_IMAGE_WIDTH_BUCKETS = [240, 480, 720, 1080, 1440, 1600]
export const BINDER_PAGE_IMAGE_DEFAULT_WIDTH = 1080
export const BINDER_PAGE_IMAGE_THUMB_WIDTH = 240

const MIN_REQUEST_WIDTH = 120
const MAX_REQUEST_WIDTH = 1600

function httpError(status, message) {
  return Object.assign(new Error(message), { httpStatus: status })
}

function nearestBucket(value) {
  return BINDER_PAGE_IMAGE_WIDTH_BUCKETS.reduce((best, bucket) =>
    Math.abs(bucket - value) < Math.abs(best - value) ? bucket : best,
  )
}

function snapExplicitWidth(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw httpError(400, 'width는 숫자여야 합니다.')
  }
  const clamped = Math.min(MAX_REQUEST_WIDTH, Math.max(MIN_REQUEST_WIDTH, Math.round(parsed)))
  return nearestBucket(clamped)
}

/**
 * width가 있으면 preset보다 우선한다. 둘 다 없으면 1080.
 * @param {{ width?: unknown, preset?: unknown }} input
 */
export function resolveBinderPageImageWidth(input = {}) {
  const width = Array.isArray(input.width) ? input.width[0] : input.width
  if (width != null && String(width).trim() !== '') {
    return snapExplicitWidth(width)
  }
  const preset = Array.isArray(input.preset) ? input.preset[0] : input.preset
  const name = String(preset ?? '').trim()
  if (!name || name === 'full') return BINDER_PAGE_IMAGE_DEFAULT_WIDTH
  if (name === 'thumb') return BINDER_PAGE_IMAGE_THUMB_WIDTH
  throw httpError(400, 'preset은 thumb 또는 full 입니다.')
}
