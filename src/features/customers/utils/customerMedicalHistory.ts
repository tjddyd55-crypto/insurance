import type { CustomerNotesBag, CustomerRecord } from '../domain/types'
import { normalizeCustomerNotesBag } from '../domain/types'

export function trimMedicalHistoryNote(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

export function resolveTreatmentHistoryNote(
  notes: Pick<CustomerNotesBag, 'treatmentHistoryNote' | 'medicationHistoryNote'> | unknown,
  legacyMedical?: string | null,
): string {
  const bag = normalizeCustomerNotesBag(notes)
  const fromNotes = trimMedicalHistoryNote(bag.treatmentHistoryNote)
  if (fromNotes) {
    return fromNotes
  }
  const medication = trimMedicalHistoryNote(bag.medicationHistoryNote)
  if (medication) {
    return ''
  }
  return trimMedicalHistoryNote(legacyMedical)
}

export function resolveMedicationHistoryNote(
  notes: Pick<CustomerNotesBag, 'medicationHistoryNote'> | unknown,
): string {
  const bag = normalizeCustomerNotesBag(notes)
  return trimMedicalHistoryNote(bag.medicationHistoryNote)
}

export function hasBothMedicalHistoryNotes(treatment: string, medication: string): boolean {
  return Boolean(trimMedicalHistoryNote(treatment) && trimMedicalHistoryNote(medication))
}

/** 레거시 `customers.medical` 컬럼·PDF·엑셀 호환용 단일 문자열 */
export function buildLegacyMedicalColumnValue(treatment: string, medication: string): string {
  const t = trimMedicalHistoryNote(treatment)
  const m = trimMedicalHistoryNote(medication)
  if (t && m) {
    return `${t}\n\n${m}`
  }
  return t || m
}

export function resolveMedicalHistoryFromCustomer(
  customer: Pick<CustomerRecord, 'notes' | 'medical'>,
): { treatmentHistoryNote: string; medicationHistoryNote: string } {
  return {
    treatmentHistoryNote: resolveTreatmentHistoryNote(customer.notes, customer.medical),
    medicationHistoryNote: resolveMedicationHistoryNote(customer.notes),
  }
}

export function formatMedicalHistoryForLegacyDisplay(
  customer: Pick<CustomerRecord, 'notes' | 'medical'>,
): string {
  const { treatmentHistoryNote, medicationHistoryNote } = resolveMedicalHistoryFromCustomer(customer)
  return buildLegacyMedicalColumnValue(treatmentHistoryNote, medicationHistoryNote)
}
