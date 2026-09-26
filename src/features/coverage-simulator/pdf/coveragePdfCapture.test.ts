import { describe, expect, it } from 'vitest'

import { COVERAGE_PDF_CAPTURE_WIDTH_PX } from './coveragePdfCapture'

describe('coveragePdfCapture', () => {
  it('uses stable A4 content width in px', () => {
    expect(COVERAGE_PDF_CAPTURE_WIDTH_PX).toBe(794)
  })
})
