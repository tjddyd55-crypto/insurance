import { FormSelect } from '../../../components/form'
import { CONTACT_RESULT_FORM_OPTIONS } from '../config/customerConsultationFollowUp.config'

type CustomerConsultationContactResultFieldProps = {
  contactResult: string
  onContactResultChange: (value: string) => void
  disabled?: boolean
  /** toolbar: 상담일자와 한 줄 / stack: 세로 라벨(기본·모바일 모달) */
  layout?: 'stack' | 'toolbar'
  className?: string
}

export default function CustomerConsultationContactResultField({
  contactResult,
  onContactResultChange,
  disabled = false,
  layout = 'stack',
  className = '',
}: CustomerConsultationContactResultFieldProps) {
  const fieldClass =
    layout === 'toolbar'
      ? `customer-consultations-composer__field customer-consultations-composer__field--contact${className ? ` ${className}` : ''}`
      : `customer-consultation-contact-field${className ? ` ${className}` : ''}`

  return (
    <label className={fieldClass}>
      <span
        className={
          layout === 'toolbar'
            ? 'customer-consultations-composer__label'
            : 'customer-consultation-contact-field__label'
        }
      >
        통화 결과
      </span>
      <FormSelect
        value={contactResult}
        onChange={(ev) => onContactResultChange(ev.target.value)}
        options={CONTACT_RESULT_FORM_OPTIONS}
        disabled={disabled}
      />
    </label>
  )
}
