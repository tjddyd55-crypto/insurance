import { describe, expect, it } from 'vitest'

import {
  COVERAGE_PDF_PREVIEW_LENGTH_ZOOM,
  computeFitScale,
  computePreviewDocumentScale,
  shouldUpdateFitScale,
} from './coveragePdfPreviewZoomMath'

describe('coveragePdfPreviewZoomMath', () => {
  it('computes fit scale from viewport width', () => {
    expect(computeFitScale(360, 794)).toBeCloseTo(360 / 794, 4)
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

  it('zooms the preview out so more document length is visible', () => {
    expect(COVERAGE_PDF_PREVIEW_LENGTH_ZOOM).toBeLessThan(1)
    expect(computePreviewDocumentScale(900, 794)).toBeCloseTo(COVERAGE_PDF_PREVIEW_LENGTH_ZOOM, 4)
    expect(computePreviewDocumentScale(360, 794)).toBeCloseTo((360 / 794) * COVERAGE_PDF_PREVIEW_LENGTH_ZOOM, 4)
  })
})
