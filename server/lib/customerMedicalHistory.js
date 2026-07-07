function trimMedicalHistoryNote(value) {
  return String(value ?? '').trim()
}

function normalizeCustomerNotesBag(raw) {
  if (Array.isArray(raw)) {
    return {
      treatmentHistoryNote: '',
      medicationHistoryNote: '',
    }
  }
  if (raw != null && typeof raw === 'object') {
    return {
      treatmentHistoryNote:
        typeof raw.treatmentHistoryNote === 'string' ? raw.treatmentHistoryNote : '',
      medicationHistoryNote:
        typeof raw.medicationHistoryNote === 'string' ? raw.medicationHistoryNote : '',
    }
  }
  return { treatmentHistoryNote: '', medicationHistoryNote: '' }
}

export function resolveTreatmentHistoryNote(notes, legacyMedical) {
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

export function resolveMedicationHistoryNote(notes) {
  const bag = normalizeCustomerNotesBag(notes)
  return trimMedicalHistoryNote(bag.medicationHistoryNote)
}

export function buildLegacyMedicalColumnValue(treatment, medication) {
  const t = trimMedicalHistoryNote(treatment)
  const m = trimMedicalHistoryNote(medication)
  if (t && m) {
    return `${t}\n\n${m}`
  }
  return t || m
}

export function formatMedicalHistoryForLegacyDisplay(customer) {
  const treatment = resolveTreatmentHistoryNote(customer?.notes, customer?.medical)
  const medication = resolveMedicationHistoryNote(customer?.notes)
  return buildLegacyMedicalColumnValue(treatment, medication)
}
