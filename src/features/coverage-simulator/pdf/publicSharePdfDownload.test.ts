import { describe, expect, it } from 'vitest'

import { isPdfBufferSignature } from './publicSharePdfDownload'
import { normalizeCoveragePdfDownloadName, toApplicationPdfBlob } from './generateCoveragePdf'

describe('publicSharePdfDownload', () => {
  it('detects PDF signature', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\n')
    expect(isPdfBufferSignature(pdf.buffer)).toBe(true)
    expect(isPdfBufferSignature(new ArrayBuffer(4))).toBe(false)
    expect(isPdfBufferSignature(new TextEncoder().encode('{"ok":').buffer)).toBe(false)
  })
})

describe('downloadCoveragePdfBlob helpers', () => {
  it('normalizes filename to end with .pdf', () => {
    expect(normalizeCoveragePdfDownloadName('foo')).toBe('foo.pdf')
    expect(normalizeCoveragePdfDownloadName('bar.PDF')).toBe('bar.PDF')
  })

  it('forces application/pdf blob type', () => {
    const blob = toApplicationPdfBlob(new Blob(['x'], { type: 'application/octet-stream' }))
    expect(blob.type).toBe('application/pdf')
  })
})
