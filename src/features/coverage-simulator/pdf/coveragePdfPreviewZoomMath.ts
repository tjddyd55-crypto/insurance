export function computeFitScale(availableWidth: number, documentNaturalWidth: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1
  if (!Number.isFinite(documentNaturalWidth) || documentNaturalWidth <= 0) return 1
  return Math.min(1, availableWidth / documentNaturalWidth)
}
