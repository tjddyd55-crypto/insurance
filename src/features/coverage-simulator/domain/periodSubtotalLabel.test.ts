import { describe, expect, it } from 'vitest'

import { periodSubtotalLabelFromMarker } from './periodSubtotalLabel'

describe('periodSubtotalLabelFromMarker', () => {
  it('maps 후 suffix to 간 합계', () => {
    expect(periodSubtotalLabelFromMarker('1년 후')).toBe('1년간 합계')
    expect(periodSubtotalLabelFromMarker('6개월 후')).toBe('6개월간 합계')
    expect(periodSubtotalLabelFromMarker('3개월 후')).toBe('3개월간 합계')
  })

  it('falls back for unknown labels', () => {
    expect(periodSubtotalLabelFromMarker('치료 단계')).toBe('구간 합계')
  })
})
