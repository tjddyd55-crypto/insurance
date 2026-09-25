import { describe, expect, it } from 'vitest'

import { ensureApplicationPdfBlob, sanitizePdfFileName } from './coveragePdfDownload'

describe('coveragePdfDownload', () => {
  it('ensures application/pdf mime', () => {
    const raw = new Blob(['%PDF'], { type: '' })
    const fixed = ensureApplicationPdfBlob(raw)
    expect(fixed.type).toBe('application/pdf')
  })

  it('sanitizes invalid filename characters', () => {
    expect(sanitizePdfFileName('김민수_암/치료.pdf')).toBe('김민수_암_치료.pdf')
  })
})
