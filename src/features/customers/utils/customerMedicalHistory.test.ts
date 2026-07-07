import { describe, expect, it } from 'vitest'
import {
  buildLegacyMedicalColumnValue,
  hasBothMedicalHistoryNotes,
  resolveMedicalHistoryFromCustomer,
  resolveMedicationHistoryNote,
  resolveTreatmentHistoryNote,
  trimMedicalHistoryNote,
} from './customerMedicalHistory'
import { normalizeCustomerNotesBag } from '../domain/types'

describe('customerMedicalHistory', () => {
  it('trimMedicalHistoryNote treats whitespace-only as empty', () => {
    expect(trimMedicalHistoryNote('  ')).toBe('')
    expect(trimMedicalHistoryNote('  abc  ')).toBe('abc')
  })

  it('resolveTreatmentHistoryNote prefers notes.treatmentHistoryNote', () => {
    const notes = normalizeCustomerNotesBag({
      items: [],
      treatmentHistoryNote: '수술 이력',
      medicationHistoryNote: '약 복용',
    })
    expect(resolveTreatmentHistoryNote(notes, 'legacy')).toBe('수술 이력')
  })

  it('resolveTreatmentHistoryNote falls back to legacy medical when split fields empty', () => {
    const notes = normalizeCustomerNotesBag({ items: [], insuranceHistory: '' })
    expect(resolveTreatmentHistoryNote(notes, '  legacy only  ')).toBe('legacy only')
  })

  it('resolveTreatmentHistoryNote does not use legacy when medication note exists', () => {
    const notes = normalizeCustomerNotesBag({
      items: [],
      medicationHistoryNote: '약만',
    })
    expect(resolveTreatmentHistoryNote(notes, 'legacy')).toBe('')
    expect(resolveMedicationHistoryNote(notes)).toBe('약만')
  })

  it('hasBothMedicalHistoryNotes is true only when both trimmed values exist', () => {
    expect(hasBothMedicalHistoryNotes('수술', '약')).toBe(true)
    expect(hasBothMedicalHistoryNotes('수술', '')).toBe(false)
    expect(hasBothMedicalHistoryNotes('', '약')).toBe(false)
  })

  it('buildLegacyMedicalColumnValue joins both sections for legacy column', () => {
    expect(buildLegacyMedicalColumnValue('수술', '약')).toBe('수술\n\n약')
    expect(buildLegacyMedicalColumnValue('수술', '')).toBe('수술')
  })

  it('resolveMedicalHistoryFromCustomer reads split notes', () => {
    const result = resolveMedicalHistoryFromCustomer({
      notes: normalizeCustomerNotesBag({
        items: [],
        treatmentHistoryNote: 'A',
        medicationHistoryNote: 'B',
      }),
      medical: '',
    })
    expect(result).toEqual({ treatmentHistoryNote: 'A', medicationHistoryNote: 'B' })
  })
})
