import { describe, expect, it } from 'vitest'

import {
  COVERAGE_PDF_PREVIEW_HORIZONTAL_GUTTER_PX,
  computeFitAvailableWidth,
  computeFitScale,
  shouldUpdateFitScale,
} from './coveragePdfPreviewZoomMath'

describe('coveragePdfPreviewZoomMath', () => {
  it('reserves a minimal preview gutter outside the PDF viewport', () => {
    expect(COVERAGE_PDF_PREVIEW_HORIZONTAL_GUTTER_PX).toBe(8)
    expect(computeFitAvailableWidth(390)).toBe(382)
  })

  it('computes fit scale from viewport width', () => {
    expect(computeFitScale(computeFitAvailableWidth(360), 794)).toBeCloseTo(
      (360 - 8) / 794,
      4,
    )
  })

  it('does not upscale documents wider than the viewport', () => {
    expect(computeFitScale(900, 794)).toBe(1)
  })

  it('skips equivalent ResizeObserver measurements', () => {
    expect(shouldUpdateFitScale(0.448363, 0.4483634)).toBe(false)
  })

  it('updates after a meaningful viewport resize', () => {
    expect(shouldUpdateFitScale(0.448, 0.52)).toBe(true)
  })
})
