import { describe, expect, it } from 'vitest'

import {
  COVERAGE_PDF_BADGE_RASTER_SHIFT_PX,
  COVERAGE_PDF_INLINE_BADGE_LABEL_STYLES,
  COVERAGE_PDF_INLINE_BADGE_STYLES,
  COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES,
  COVERAGE_PDF_TITLE_RASTER_SHIFT_PX,
} from './coveragePdfTitleTextSafety'

describe('coveragePdfTitleTextSafety', () => {
  it('defines print-safe inline title styles without ellipsis', () => {
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.whiteSpace).toBe('normal')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.overflow).toBe('visible')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.textOverflow).toBe('clip')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.lineHeight).toBe('22px')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.height).toBe('22px')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.fontSize).toBe('14px')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.top).toBe('0')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.boxShadow).toBe('none')
  })

  it('pins badge text to an explicit line box without a live baseline shift', () => {
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.display).toBe('inline-block')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.lineHeight).toBe('22px')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.height).toBe('22px')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.fontSize).toBe('11px')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.textAlign).toBe('center')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.padding).toBe('0 8px')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.transform).toBe('none')
    expect(COVERAGE_PDF_INLINE_BADGE_LABEL_STYLES.top).toBe('0')
    expect(COVERAGE_PDF_INLINE_BADGE_LABEL_STYLES.lineHeight).toBe('22px')
  })

  it('keeps html2canvas glyph shifts out of the live line box', () => {
    expect(COVERAGE_PDF_BADGE_RASTER_SHIFT_PX).toBe('-6px')
    expect(COVERAGE_PDF_TITLE_RASTER_SHIFT_PX).toBe('-8px')
    expect(COVERAGE_PDF_INLINE_BADGE_LABEL_STYLES.top).not.toBe(COVERAGE_PDF_BADGE_RASTER_SHIFT_PX)
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.top).not.toBe(COVERAGE_PDF_TITLE_RASTER_SHIFT_PX)
  })
})
