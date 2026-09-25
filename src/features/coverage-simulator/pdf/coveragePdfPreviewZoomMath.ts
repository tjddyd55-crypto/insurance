export const COVERAGE_PDF_FIT_SCALE_EPSILON = 0.001

export function computeFitScale(availableWidth: number, documentNaturalWidth: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1
  if (!Number.isFinite(documentNaturalWidth) || documentNaturalWidth <= 0) return 1
  return Math.min(1, availableWidth / documentNaturalWidth)
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
