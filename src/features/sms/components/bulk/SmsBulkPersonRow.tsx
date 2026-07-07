import { formatCompactGender } from '../../utils/smsRecipientEligibility'
import { formatSmsPersonBirthDisplay } from '../../utils/formatSmsPersonBirthDisplay'

type Props = {
  name: string
  gender: 'male' | 'female' | null
  genderLabel: string
  birthDate: string | null
  phoneDisplay: string
  checked: boolean
  disabled?: boolean
  onCheckChange: () => void
}

export default function SmsBulkPersonRow({
  name,
  gender,
  genderLabel,
  birthDate,
  phoneDisplay,
  checked,
  disabled,
  onCheckChange,
}: Props) {
  return (
    <div className="sms-bulk-person-row">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onCheckChange}
      />
      <span className="sms-bulk-person-row__name">{name || '-'}</span>
      <span className="sms-bulk-person-row__gender">{formatCompactGender(gender, genderLabel)}</span>
      <span className="sms-bulk-person-row__birth">{formatSmsPersonBirthDisplay(birthDate, true)}</span>
      <span className="sms-bulk-person-row__phone">{phoneDisplay}</span>
    </div>
  )
}
