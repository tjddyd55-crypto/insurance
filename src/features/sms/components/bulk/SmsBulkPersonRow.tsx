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
  showRemove?: boolean
  onRemove?: () => void
  removeLabel?: string
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
  showRemove = false,
  onRemove,
  removeLabel = '제거',
}: Props) {
  const rowClassName = `sms-bulk-compact-row sms-bulk-person-row sms-bulk-compact-row--${layout}${
    showRemove ? ' sms-bulk-person-row--with-action' : ''
  }`

  const checkbox = (
    <input
      type="checkbox"
      className="sms-bulk-compact-row__check sms-bulk-person-row__check"
      checked={checked}
      disabled={disabled}
      onChange={onCheckChange}
    />
  )

  const cells = (
    <>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__name">{name || '-'}</span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__gender">
        {formatCompactGender(gender, genderLabel)}
      </span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__birth">
        {formatSmsPersonBirthDisplay(birthDate, true)}
      </span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__phone">{phoneDisplay}</span>
    </>
  )

  const removeButton =
    showRemove && onRemove ? (
      <button
        type="button"
        className="sms-bulk-person-row__remove"
        disabled={disabled}
        onClick={onRemove}
      >
        {removeLabel}
      </button>
    ) : null

  if (!showRemove) {
    return (
      <label className={`${rowClassName} sms-bulk-compact-row--customer`}>
        {checkbox}
        {cells}
      </label>
    )
  }

  return (
    <div className={rowClassName}>
      {checkbox}
      {cells}
      {removeButton}
    </div>
  )
}
