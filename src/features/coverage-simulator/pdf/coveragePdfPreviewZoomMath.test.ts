import { describe, expect, it } from 'vitest'

import {
  computeFitScale,
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
})
