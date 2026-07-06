import { formatCompactGender } from '../../utils/smsRecipientEligibility'
import { formatSmsPersonBirthDisplay } from '../../utils/formatSmsPersonBirthDisplay'

type Props = {
  layout: 'pc' | 'mobile'
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
  layout,
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
    <label className={`sms-bulk-compact-row sms-bulk-person-row sms-bulk-compact-row--${layout} sms-bulk-compact-row--customer`}>
      <input
        type="checkbox"
        className="sms-bulk-compact-row__check sms-bulk-person-row__check"
        checked={checked}
        disabled={disabled}
        onChange={onCheckChange}
      />
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__name">{name || '-'}</span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__gender">
        {formatCompactGender(gender, genderLabel)}
      </span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__birth">
        {formatSmsPersonBirthDisplay(birthDate, true)}
      </span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__phone">{phoneDisplay}</span>
    </label>
  )
}
