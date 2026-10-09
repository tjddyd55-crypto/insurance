import { describe, expect, it } from 'vitest'

import { resolveBirthDateVsRrnConflict } from './customerExcelBirthRrnValidation'

describe('customerExcelBirthRrnValidation', () => {
  it('passes when birth matches rrn', () => {
    expect(resolveBirthDateVsRrnConflict('1980-01-01', '8001011234567')).toEqual({ ok: true })
  })

  it('fails when birth conflicts with rrn', () => {
    expect(resolveBirthDateVsRrnConflict('1990-01-01', '8001011234567').ok).toBe(false)
  })
})
