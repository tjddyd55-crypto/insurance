export type BinderPdfViewerFitMode = 'width' | 'page'

export function computeBinderPdfDisplayScale(params: {
  pageWidth: number
  pageHeight: number
  containerWidth: number
  containerHeight: number
  fit: BinderPdfViewerFitMode
  zoom: number
  padding?: number
}): number {
  const padding = params.padding ?? 16
  const availW = Math.max(1, params.containerWidth - padding * 2)
  const availH = Math.max(1, params.containerHeight - padding * 2)
  const widthScale = availW / Math.max(1, params.pageWidth)
  let fitScale = widthScale
  if (params.fit === 'page') {
    fitScale = Math.min(widthScale, availH / Math.max(1, params.pageHeight))
  }
  const zoom = Number.isFinite(params.zoom) ? params.zoom : 1
  return Math.max(0.1, fitScale * zoom)
}
