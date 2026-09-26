export const A4_PAGE_WIDTH_MM = 210
export const A4_PAGE_HEIGHT_MM = 297
export const COVERAGE_PDF_PAGE_EPSILON_MM = 0.5
export const COVERAGE_PDF_ONE_PAGE_MIN_SCALE = 0.92

export type CoveragePdfPageSlice = {
  sourceY: number
  sourceHeight: number
}

export type CoveragePdfPagePlan = {
  pageCount: number
  renderScale: number
  scaledImageHeightMm: number
  usableHeightMm: number
  slices: CoveragePdfPageSlice[]
}

type CalculateCoveragePdfPagePlanInput = {
  canvasWidth: number
  canvasHeight: number
  pdfPageWidthMm?: number
  pdfPageHeightMm?: number
  epsilonMm?: number
  onePageMinScale?: number
  safeBreakpointsPx?: number[]
}

function normalizedBreakpoints(
  breakpoints: number[],
  canvasHeight: number,
): number[] {
  return [...new Set(breakpoints)]
    .filter((point) => Number.isFinite(point) && point > 0 && point < canvasHeight)
    .sort((left, right) => left - right)
}

function chooseSafeSliceEnd(
  sourceY: number,
  idealEnd: number,
  canvasHeight: number,
  breakpoints: number[],
): number {
  if (idealEnd >= canvasHeight) return canvasHeight

  const minimumUsefulEnd = sourceY + (idealEnd - sourceY) * 0.65
  const candidates = breakpoints.filter(
    (point) => point >= minimumUsefulEnd && point <= idealEnd,
  )
  return candidates.at(-1) ?? idealEnd
}

export function calculateCoveragePdfPagePlan({
  canvasWidth,
  canvasHeight,
  pdfPageWidthMm = A4_PAGE_WIDTH_MM,
  pdfPageHeightMm = A4_PAGE_HEIGHT_MM,
  epsilonMm = COVERAGE_PDF_PAGE_EPSILON_MM,
  onePageMinScale = COVERAGE_PDF_ONE_PAGE_MIN_SCALE,
  safeBreakpointsPx = [],
}: CalculateCoveragePdfPagePlanInput): CoveragePdfPagePlan {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    throw new Error('PDF canvas dimensions must be positive.')
  }

  const naturalImageHeightMm = (canvasHeight * pdfPageWidthMm) / canvasWidth
  const fitScale = pdfPageHeightMm / naturalImageHeightMm
  const canFitOnePage =
    naturalImageHeightMm <= pdfPageHeightMm + epsilonMm ||
    fitScale >= onePageMinScale

  if (canFitOnePage) {
    const renderScale = Math.min(1, fitScale)
    return {
      pageCount: 1,
      renderScale,
      scaledImageHeightMm: naturalImageHeightMm * renderScale,
      usableHeightMm: pdfPageHeightMm,
      slices: [{ sourceY: 0, sourceHeight: canvasHeight }],
    }
  }

  const pixelsPerPage = (pdfPageHeightMm * canvasWidth) / pdfPageWidthMm
  const breakpoints = normalizedBreakpoints(safeBreakpointsPx, canvasHeight)
  const slices: CoveragePdfPageSlice[] = []
  let sourceY = 0

  while (sourceY < canvasHeight) {
    const idealEnd = Math.min(canvasHeight, sourceY + pixelsPerPage)
    const sliceEnd = chooseSafeSliceEnd(
      sourceY,
      idealEnd,
      canvasHeight,
      breakpoints,
    )
    const sourceHeight = sliceEnd - sourceY
    if (sourceHeight <= 0) {
      throw new Error('PDF page slicing did not make progress.')
    }
    slices.push({ sourceY, sourceHeight })
    sourceY = sliceEnd
  }

  return {
    pageCount: slices.length,
    renderScale: 1,
    scaledImageHeightMm: naturalImageHeightMm,
    usableHeightMm: pdfPageHeightMm,
    slices,
  }
}
