import { FormInput, FormSelect, FormTextarea } from '../../../components/form'
import {
  CONTACT_RESULT_FORM_OPTIONS,
  FOLLOW_UP_STATUS_FORM_OPTIONS,
} from '../config/customerConsultationFollowUp.config'

type CustomerConsultationFollowUpFieldsProps = {
  contactResult: string
  followUpStatus: string
  nextContactDate: string
  followUpNote: string
  onContactResultChange: (value: string) => void
  onFollowUpStatusChange: (value: string) => void
  onNextContactDateChange: (value: string) => void
  onFollowUpNoteChange: (value: string) => void
  disabled?: boolean
}

export default function CustomerConsultationFollowUpFields({
  contactResult,
  followUpStatus,
  nextContactDate,
  followUpNote,
  onContactResultChange,
  onFollowUpStatusChange,
  onNextContactDateChange,
  onFollowUpNoteChange,
  disabled = false,
}: CustomerConsultationFollowUpFieldsProps) {
  return (
    <div className="customer-consultation-follow-up-fields" style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <label style={{ display: 'block' }}>
        통화 결과{' '}
        <FormSelect
          value={contactResult}
          onChange={(ev) => onContactResultChange(ev.target.value)}
          options={CONTACT_RESULT_FORM_OPTIONS}
          disabled={disabled}
        />
      </label>
      <label style={{ display: 'block' }}>
        후속 상태{' '}
        <FormSelect
          value={followUpStatus}
          onChange={(ev) => onFollowUpStatusChange(ev.target.value)}
          options={FOLLOW_UP_STATUS_FORM_OPTIONS}
          disabled={disabled}
        />
      </label>
      <label style={{ display: 'block' }}>
        다음 연락 예정일{' '}
        <FormInput
          type="date"
          value={nextContactDate}
          onChange={(ev) => onNextContactDateChange(ev.target.value)}
          disabled={disabled}
        />
      </label>
      <label style={{ display: 'block' }}>
        후속 메모{' '}
        <FormTextarea
          value={followUpNote}
          onChange={(ev) => onFollowUpNoteChange(ev.target.value)}
          rows={2}
          style={{ width: '100%', padding: 8 }}
          placeholder="후속 연락 시 참고할 메모 (선택)"
          maxLength={2000}
          disabled={disabled}
        />
      </label>
    </div>
  )
}
