import { describe, expect, it } from 'vitest'

import {
  calculateCoveragePdfPagePlan,
  COVERAGE_PDF_PAGE_EPSILON_MM,
} from './coveragePdfPageSlices'

const CANVAS_WIDTH = 1588
const A4_HEIGHT_PX_AT_SCALE_2 = 2245.2

describe('calculateCoveragePdfPagePlan', () => {
  it('keeps exact A4 content on one page', () => {
    const plan = calculateCoveragePdfPagePlan({
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: A4_HEIGHT_PX_AT_SCALE_2,
    })
    expect(plan.pageCount).toBe(1)
    expect(plan.renderScale).toBeCloseTo(1)
  })

  it('does not create a trailing page for a sub-epsilon overrun', () => {
    const epsilonPx =
      (COVERAGE_PDF_PAGE_EPSILON_MM * CANVAS_WIDTH) / 210
    const plan = calculateCoveragePdfPagePlan({
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: A4_HEIGHT_PX_AT_SCALE_2 + epsilonPx * 0.9,
    })
    expect(plan.pageCount).toBe(1)
  })

  it('fits a slight overrun on one page within the readability floor', () => {
    const plan = calculateCoveragePdfPagePlan({
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: A4_HEIGHT_PX_AT_SCALE_2 / 0.95,
    })
    expect(plan.pageCount).toBe(1)
    expect(plan.renderScale).toBeCloseTo(0.95, 2)
  })

  it('uses multiple pages when one-page scale would be too small', () => {
    const plan = calculateCoveragePdfPagePlan({
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: A4_HEIGHT_PX_AT_SCALE_2 * 1.6,
    })
    expect(plan.pageCount).toBeGreaterThan(1)
  })

  it('does not append a blank page at an exact two-page boundary', () => {
    const plan = calculateCoveragePdfPagePlan({
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: A4_HEIGHT_PX_AT_SCALE_2 * 2,
    })
    expect(plan.pageCount).toBe(2)
    expect(plan.slices).toHaveLength(2)
  })

  it('uses a nearby safe breakpoint instead of cutting a row', () => {
    const firstSafeBreak = 2100
    const plan = calculateCoveragePdfPagePlan({
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: A4_HEIGHT_PX_AT_SCALE_2 * 1.5,
      safeBreakpointsPx: [firstSafeBreak],
    })
    expect(plan.slices[0]).toEqual({
      sourceY: 0,
      sourceHeight: firstSafeBreak,
    })
  })
})
