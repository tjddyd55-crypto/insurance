export const COVERAGE_PDF_FIT_SCALE_EPSILON = 0.001

/**
 * 미리보기는 너비에 맞춘 뒤 이 비율만큼 더 축소해 문서 길이가 더 보이게 한다.
 * 1보다 작다. 핀치 줌의 기준(zoom=1)은 이 축소본이다.
 */
export const COVERAGE_PDF_PREVIEW_LENGTH_ZOOM = 0.82

export function computeFitScale(availableWidth: number, documentNaturalWidth: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1
  if (!Number.isFinite(documentNaturalWidth) || documentNaturalWidth <= 0) return 1
  return Math.min(1, availableWidth / documentNaturalWidth)
}

export function computePreviewDocumentScale(
  availableWidth: number,
  documentNaturalWidth: number,
  lengthZoom: number = COVERAGE_PDF_PREVIEW_LENGTH_ZOOM,
): number {
  const zoom = Number.isFinite(lengthZoom) && lengthZoom > 0 ? lengthZoom : COVERAGE_PDF_PREVIEW_LENGTH_ZOOM
  return computeFitScale(availableWidth, documentNaturalWidth) * zoom
}

export function shouldUpdateFitScale(
  current: number,
  next: number,
  epsilon = COVERAGE_PDF_FIT_SCALE_EPSILON,
): boolean {
  if (!Number.isFinite(next) || next <= 0) return false
  if (!Number.isFinite(current) || current <= 0) return true
  return Math.abs(current - next) >= epsilon
}
