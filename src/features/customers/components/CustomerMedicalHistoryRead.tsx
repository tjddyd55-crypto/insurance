import {
  CUSTOMER_MEDICAL_MEDICATION_LABEL,
  CUSTOMER_MEDICAL_QUESTION_HINT,
  CUSTOMER_MEDICAL_QUESTION_TEXT,
  CUSTOMER_MEDICAL_TREATMENT_LABEL,
} from '../utils/customerDisplayFormat'
import {
  hasBothMedicalHistoryNotes,
  trimMedicalHistoryNote,
} from '../utils/customerMedicalHistory'

export type CustomerMedicalHistoryReadProps = {
  treatmentHistoryNote: string
  medicationHistoryNote: string
}

export default function CustomerMedicalHistoryRead({
  treatmentHistoryNote,
  medicationHistoryNote,
}: CustomerMedicalHistoryReadProps) {
  const treatment = trimMedicalHistoryNote(treatmentHistoryNote)
  const medication = trimMedicalHistoryNote(medicationHistoryNote)
  const showDivider = hasBothMedicalHistoryNotes(treatment, medication)

  if (!treatment && !medication) {
    return <p className="customer-detail-read__info-answer">—</p>
  }

  if (!showDivider) {
    return (
      <p className="customer-detail-read__info-answer customer-medical-history-read__text">
        {treatment || medication}
      </p>
    )
  }

  return (
    <div
      className={
        showDivider
          ? 'customer-medical-history-read customer-medical-history-read--with-divider'
          : 'customer-medical-history-read'
      }
    >
      <div className="customer-medical-history-read__block">
        <span className="customer-medical-history-read__sub-label">{CUSTOMER_MEDICAL_TREATMENT_LABEL}</span>
        <p className="customer-detail-read__info-answer customer-medical-history-read__text">{treatment}</p>
      </div>
      <hr className="customer-medical-history-read__divider" aria-hidden="true" />
      <div className="customer-medical-history-read__block">
        <span className="customer-medical-history-read__sub-label">{CUSTOMER_MEDICAL_MEDICATION_LABEL}</span>
        <p className="customer-detail-read__info-answer customer-medical-history-read__text">{medication}</p>
      </div>
    </div>
  )
}

export function CustomerMedicalHistoryReadSection({
  treatmentHistoryNote,
  medicationHistoryNote,
}: CustomerMedicalHistoryReadProps) {
  return (
    <div>
      <span className="customer-detail-read__info-label">{CUSTOMER_MEDICAL_QUESTION_TEXT}</span>
      <p className="customer-detail-read__info-hint">{CUSTOMER_MEDICAL_QUESTION_HINT}</p>
      <CustomerMedicalHistoryRead
        treatmentHistoryNote={treatmentHistoryNote}
        medicationHistoryNote={medicationHistoryNote}
      />
    </div>
  )
}
