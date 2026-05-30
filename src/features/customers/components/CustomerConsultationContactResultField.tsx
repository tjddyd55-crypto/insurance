import { FormSelect } from '../../../components/form'
import { CONTACT_RESULT_FORM_OPTIONS } from '../config/customerConsultationFollowUp.config'

type CustomerConsultationContactResultFieldProps = {
  contactResult: string
  onContactResultChange: (value: string) => void
  disabled?: boolean
}

export default function CustomerConsultationContactResultField({
  contactResult,
  onContactResultChange,
  disabled = false,
}: CustomerConsultationContactResultFieldProps) {
  return (
    <label style={{ display: 'block', marginTop: 8 }}>
      통화 결과{' '}
      <FormSelect
        value={contactResult}
        onChange={(ev) => onContactResultChange(ev.target.value)}
        options={CONTACT_RESULT_FORM_OPTIONS}
        disabled={disabled}
      />
    </label>
  )
}
