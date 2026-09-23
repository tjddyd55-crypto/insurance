import { describe, expect, it } from 'vitest'

import {
  formatCoverageAmountLabel,
  formatManWonInput,
  formatTotalAmountLabel,
  parseManWonInput,
} from './formatAmount'

describe('formatAmount', () => {
  it('parses and formats man-won input', () => {
    expect(parseManWonInput('3000')).toBe(30_000_000)
    expect(formatManWonInput(30_000_000)).toBe('3000')
  })

  it('formats coverage labels', () => {
    expect(formatCoverageAmountLabel(null)).toBe('없음')
    expect(formatCoverageAmountLabel(30_000_000)).toBe('3,000만원')
  })

  it('formats large totals', () => {
    expect(formatTotalAmountLabel(125_000_000)).toBe('1억 2,500만원')
  })
})
