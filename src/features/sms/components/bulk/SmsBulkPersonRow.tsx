import { formatCompactGender } from '../../utils/smsRecipientEligibility'
import { formatSmsPersonBirthDisplay } from '../../utils/formatSmsPersonBirthDisplay'
import { createSmsBulkPersonRowHandlers } from '../../utils/smsBulkPersonRowInteraction'

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
  const { handleRowClick, handleCheckboxClick, handleCheckboxChange, handleRowKeyDown } =
    createSmsBulkPersonRowHandlers(onCheckChange, disabled)

  return (
    <div
      className="sms-bulk-person-row"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onClick={handleCheckboxClick}
        onChange={handleCheckboxChange}
        aria-label={`${name || '고객'} 선택`}
      />
      <span className="sms-bulk-person-row__name">{name || '-'}</span>
      <span className="sms-bulk-person-row__gender">{formatCompactGender(gender, genderLabel)}</span>
      <span className="sms-bulk-person-row__birth">{formatSmsPersonBirthDisplay(birthDate, true)}</span>
      <span className="sms-bulk-person-row__phone">{phoneDisplay}</span>
    </div>
  )
}
