import { describe, expect, it } from 'vitest'
import { formatSmsPersonBirthDisplay } from './formatSmsPersonBirthDisplay'

describe('formatSmsPersonBirthDisplay', () => {
  it('returns full birth date when compact mode is off', () => {
    expect(formatSmsPersonBirthDisplay('1984-02-18', false)).toBe('1984-02-18')
  })

  it('returns birth year only in compact mode', () => {
    expect(formatSmsPersonBirthDisplay('1984-02-18', true)).toBe('1984')
  })

  it('returns dash when birth date is missing', () => {
    expect(formatSmsPersonBirthDisplay(null, true)).toBe('-')
  })
})
