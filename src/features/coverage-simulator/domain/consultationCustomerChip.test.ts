import { describe, expect, it } from 'vitest'

import {
  coverageCustomerNumericId,
  formatCoverageChipBirthDate,
  formatCoverageChipPhone,
  formatCoverageEditorCustomerLine,
} from './consultationCustomerChip'

describe('consultationCustomerChip', () => {
  it('joins name, birth date, and phone and drops empty parts', () => {
    expect(
      formatCoverageEditorCustomerLine({
        name: '김민수',
        birthDate: '1990.03.15',
        phone: '010-1234-5678',
      }),
    ).toBe('김민수 · 1990.03.15 · 010-1234-5678')
    expect(
      formatCoverageEditorCustomerLine({
        name: '김민수',
        birthDate: null,
        phone: '010-1234-5678',
      }),
    ).toBe('김민수 · 010-1234-5678')
    expect(
      formatCoverageEditorCustomerLine({
        name: '김민수',
        birthDate: '1990.03.15',
        phone: '',
      }),
    ).toBe('김민수 · 1990.03.15')
  })

  it('never keeps a dash placeholder', () => {
    expect(
      formatCoverageEditorCustomerLine({
        name: '김민수',
        birthDate: '—',
        phone: '—',
      }),
    ).toBe('김민수')
    expect(formatCoverageChipBirthDate({ birthDate: '—', ssn: '' })).toBeNull()
    expect(formatCoverageChipPhone('—')).toBeNull()
  })

  it('formats birth date from the field, then from the resident number', () => {
    expect(formatCoverageChipBirthDate({ birthDate: '1990-03-15', ssn: '850101-1234567' })).toBe(
      '1990.03.15',
    )
    expect(formatCoverageChipBirthDate({ birthDate: '', ssn: '900315-1234567' })).toBe('1990.03.15')
    expect(formatCoverageChipBirthDate({ birthDate: null, ssn: '' })).toBeNull()
  })

  it('formats a mobile number and leaves a short value as typed', () => {
    expect(formatCoverageChipPhone('01012345678')).toBe('010-1234-5678')
    expect(formatCoverageChipPhone('  ')).toBeNull()
  })

  it('accepts only a positive integer customer id', () => {
    expect(coverageCustomerNumericId('42')).toBe(42)
    expect(coverageCustomerNumericId('preview-customer-kim')).toBeNull()
    expect(coverageCustomerNumericId('0')).toBeNull()
    expect(coverageCustomerNumericId(null)).toBeNull()
  })
})
