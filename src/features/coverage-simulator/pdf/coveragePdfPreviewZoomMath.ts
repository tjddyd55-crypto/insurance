export const PDF_PREVIEW_ZOOM_MIN = 1
export const PDF_PREVIEW_ZOOM_MAX = 3

export function clampPdfPreviewZoom(zoom: number): number {
  return Math.min(PDF_PREVIEW_ZOOM_MAX, Math.max(PDF_PREVIEW_ZOOM_MIN, zoom))
}

export function computeFitScale(availableWidth: number, documentNaturalWidth: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1
  if (!Number.isFinite(documentNaturalWidth) || documentNaturalWidth <= 0) return 1
  return Math.min(1, availableWidth / documentNaturalWidth)
}

export function computePinchZoom(initialZoom: number, initialDistance: number, currentDistance: number): number {
  if (initialDistance <= 0 || currentDistance <= 0) return clampPdfPreviewZoom(initialZoom)
  return clampPdfPreviewZoom(initialZoom * (currentDistance / initialDistance))
}

export function effectivePdfPreviewScale(fitScale: number, zoom: number): number {
  return fitScale * zoom
}
