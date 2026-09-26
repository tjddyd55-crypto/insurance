import { describe, expect, it } from 'vitest'

import {
  COVERAGE_PDF_INLINE_BADGE_GLYPH_STYLES,
  COVERAGE_PDF_INLINE_BADGE_STYLES,
  COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES,
} from './coveragePdfTitleTextSafety'

describe('coveragePdfTitleTextSafety', () => {
  it('defines print-safe inline title styles without ellipsis', () => {
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.whiteSpace).toBe('normal')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.overflow).toBe('visible')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.textOverflow).toBe('clip')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.lineHeight).toBe('1.45')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.boxShadow).toBe('none')
  })

  it('centers print badge text without baseline transforms', () => {
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.display).toBe('inline-flex')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.alignItems).toBe('center')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.justifyContent).toBe('center')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.lineHeight).toBe('1')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.padding).toBe('0 8px')
    expect(COVERAGE_PDF_INLINE_BADGE_STYLES.transform).toBe('none')
  })

  it('applies optical glyph correction for Korean badge raster', () => {
    expect(COVERAGE_PDF_INLINE_BADGE_GLYPH_STYLES.lineHeight).toBe('1')
    expect(COVERAGE_PDF_INLINE_BADGE_GLYPH_STYLES.transform).toBe('translateY(-0.75px)')
  })
})
