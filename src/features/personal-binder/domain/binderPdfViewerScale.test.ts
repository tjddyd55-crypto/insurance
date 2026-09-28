import { describe, expect, it } from 'vitest'

import { computeBinderPdfDisplayScale } from './binderPdfViewerScale'

describe('computeBinderPdfDisplayScale', () => {
  const a4Portrait = { pageWidth: 595, pageHeight: 842 }

  it('fit-page uses the smaller of width and height scale', () => {
    const scale = computeBinderPdfDisplayScale({
      ...a4Portrait,
      containerWidth: 800,
      containerHeight: 600,
      fit: 'page',
      zoom: 1,
      padding: 16,
    })
    const widthScale = (800 - 32) / 595
    const heightScale = (600 - 32) / 842
    expect(scale).toBeCloseTo(Math.min(widthScale, heightScale), 5)
  })

  it('fit-width ignores container height', () => {
    const scale = computeBinderPdfDisplayScale({
      ...a4Portrait,
      containerWidth: 800,
      containerHeight: 400,
      fit: 'width',
      zoom: 1,
      padding: 16,
    })
    expect(scale).toBeCloseTo((800 - 32) / 595, 5)
  })

  it('applies zoom multiplier on top of fit scale', () => {
    const base = computeBinderPdfDisplayScale({
      ...a4Portrait,
      containerWidth: 800,
      containerHeight: 900,
      fit: 'page',
      zoom: 1,
    })
    const zoomed = computeBinderPdfDisplayScale({
      ...a4Portrait,
      containerWidth: 800,
      containerHeight: 900,
      fit: 'page',
      zoom: 1.5,
    })
    expect(zoomed).toBeCloseTo(base * 1.5, 5)
  })
})
