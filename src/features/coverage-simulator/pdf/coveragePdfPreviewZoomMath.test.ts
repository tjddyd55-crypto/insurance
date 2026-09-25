import { describe, expect, it } from 'vitest'

import { computeFitScale } from './coveragePdfPreviewZoomMath'

describe('coveragePdfPreviewZoomMath', () => {
  it('computes fit scale from viewport width', () => {
    expect(computeFitScale(360, 794)).toBeCloseTo(360 / 794, 4)
  })

  it('does not upscale documents wider than the viewport', () => {
    expect(computeFitScale(900, 794)).toBe(1)
  })
})
