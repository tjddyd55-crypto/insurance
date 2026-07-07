import { FormTextarea } from '../../../components/form'
import {
  CUSTOMER_MEDICAL_MEDICATION_LABEL,
  CUSTOMER_MEDICAL_MEDICATION_PLACEHOLDER,
  CUSTOMER_MEDICAL_QUESTION_TEXT,
  CUSTOMER_MEDICAL_TREATMENT_LABEL,
  CUSTOMER_MEDICAL_TREATMENT_PLACEHOLDER,
} from '../utils/customerDisplayFormat'
import { hasBothMedicalHistoryNotes } from '../utils/customerMedicalHistory'
import { CustomerFormSection } from './CustomerFormSection'

export type CustomerMedicalHistoryFieldsProps = {
  treatmentHistoryNote: string
  medicationHistoryNote: string
  onTreatmentChange: (value: string) => void
  onMedicationChange: (value: string) => void
  treatmentName?: string
  medicationName?: string
}

export default function CustomerMedicalHistoryFields({
  treatmentHistoryNote,
  medicationHistoryNote,
  onTreatmentChange,
  onMedicationChange,
  treatmentName = 'customer-medical-treatment',
  medicationName = 'customer-medical-medication',
}: CustomerMedicalHistoryFieldsProps) {
  const showDivider = hasBothMedicalHistoryNotes(treatmentHistoryNote, medicationHistoryNote)

  return (
    <CustomerFormSection
      title={CUSTOMER_MEDICAL_QUESTION_TEXT}
      className="field field--wide"
      description="입력 형식은 아래 칸의 예시(placeholder)를 참고하세요."
    >
      <div
        className={
          showDivider
            ? 'customer-medical-history-fields customer-medical-history-fields--with-divider'
            : 'customer-medical-history-fields'
        }
      >
        <label className="customer-medical-history-fields__block">
          <span className="customer-medical-history-fields__label">{CUSTOMER_MEDICAL_TREATMENT_LABEL}</span>
          <FormTextarea
            className="field__control customer-form-textarea customer-form-textarea--large customer-textarea--medical-history"
            rows={4}
            name={treatmentName}
            placeholder={CUSTOMER_MEDICAL_TREATMENT_PLACEHOLDER}
            aria-label={CUSTOMER_MEDICAL_TREATMENT_LABEL}
            value={treatmentHistoryNote}
            onChange={(e) => onTreatmentChange(e.target.value)}
          />
        </label>
        <label className="customer-medical-history-fields__block">
          <span className="customer-medical-history-fields__label">{CUSTOMER_MEDICAL_MEDICATION_LABEL}</span>
          <FormTextarea
            className="field__control customer-form-textarea customer-form-textarea--large customer-textarea--medical-history"
            rows={4}
            name={medicationName}
            placeholder={CUSTOMER_MEDICAL_MEDICATION_PLACEHOLDER}
            aria-label={CUSTOMER_MEDICAL_MEDICATION_LABEL}
            value={medicationHistoryNote}
            onChange={(e) => onMedicationChange(e.target.value)}
          />
        </label>
      </div>
    </CustomerFormSection>
  )
}
