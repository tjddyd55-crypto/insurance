import { describe, expect, it } from 'vitest'

import {
  formatCoverageAmountLabel,
  formatManWonInput,
  formatManWonInputDisplay,
  formatTotalAmountLabel,
  parseManWonInput,
  sanitizeManWonInputTyping,
} from './formatAmount'

describe('formatAmount', () => {
  it('parses and formats man-won input', () => {
    expect(parseManWonInput('3000')).toBe(30_000_000)
    expect(formatManWonInput(30_000_000)).toBe('3000')
  })

  it('formats coverage labels', () => {
    expect(formatCoverageAmountLabel(null)).toBe('없음')
    expect(formatCoverageAmountLabel(30_000_000)).toBe('3,000 만원')
    expect(formatCoverageAmountLabel(3_000_000)).toBe('300 만원')
  })

  it('formats large totals', () => {
    expect(formatTotalAmountLabel(125_000_000)).toBe('1억 2,500 만원')
  })

  it('formats man-won input display with commas', () => {
    expect(formatManWonInputDisplay(10_000_000)).toBe('1,000')
    expect(sanitizeManWonInputTyping('10,000,000')).toBe('10,000,000')
    expect(parseManWonInput('1,000')).toBe(10_000_000)
  })
})
