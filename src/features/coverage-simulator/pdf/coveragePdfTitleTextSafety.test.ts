import { describe, expect, it } from 'vitest'

import { COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES } from './coveragePdfTitleTextSafety'

describe('coveragePdfTitleTextSafety', () => {
  it('defines print-safe inline title styles without ellipsis', () => {
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.whiteSpace).toBe('normal')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.overflow).toBe('visible')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.textOverflow).toBe('clip')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.lineHeight).toBe('1.45')
    expect(COVERAGE_PDF_INLINE_TITLE_LABEL_STYLES.boxShadow).toBe('none')
  })
})
