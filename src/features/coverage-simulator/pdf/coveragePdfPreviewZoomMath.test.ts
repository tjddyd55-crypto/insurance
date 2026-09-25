import { describe, expect, it } from 'vitest'

import {
  clampPdfPreviewZoom,
  computeFitScale,
  computePinchZoom,
  effectivePdfPreviewScale,
} from './coveragePdfPreviewZoomMath'

describe('coveragePdfPreviewZoomMath', () => {
  it('computes fit scale from viewport width', () => {
    expect(computeFitScale(360, 794)).toBeCloseTo(360 / 794, 4)
  })

  it('pinch out increases zoom up to max', () => {
    expect(computePinchZoom(1, 100, 200)).toBe(2)
    expect(computePinchZoom(2, 100, 250)).toBe(3)
  })

  it('pinch in decreases zoom down to min 1', () => {
    expect(computePinchZoom(2, 200, 100)).toBe(1)
  })

  it('effective scale combines fit and zoom', () => {
    expect(effectivePdfPreviewScale(0.5, 2)).toBe(1)
  })

  it('clamps zoom', () => {
    expect(clampPdfPreviewZoom(5)).toBe(3)
    expect(clampPdfPreviewZoom(0.2)).toBe(1)
  })
})
