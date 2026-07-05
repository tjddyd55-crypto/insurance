import FormButton from '../../../../components/form/FormButton'
import { formatCompactGender, formatSmsBlockedReason } from '../../utils/smsRecipientEligibility'
import { formatSmsPersonBirthDisplay } from '../../utils/formatSmsPersonBirthDisplay'

type PersonFields = {
  name: string
  gender: 'male' | 'female' | null
  genderLabel: string
  birthDate: string | null
  phoneDisplay: string
}

type BaseProps = PersonFields & {
  layout: 'pc' | 'mobile'
  compactBirth?: boolean
  disabled?: boolean
  checked: boolean
  onCheckChange: () => void
  showStatus?: boolean
  canSend?: boolean
  blockedReason?: string | null
  onRemove?: () => void
  removeLabel?: string
}

function PersonRowCells({
  name,
  gender,
  genderLabel,
  birthDate,
  phoneDisplay,
  compactBirth,
  showStatus,
  canSend,
  blockedReason,
}: PersonFields & {
  compactBirth: boolean
  showStatus: boolean
  canSend?: boolean
  blockedReason?: string | null
}) {
  return (
    <>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__name">{name || '-'}</span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__gender">
        {formatCompactGender(gender, genderLabel)}
      </span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__birth">
        {formatSmsPersonBirthDisplay(birthDate, compactBirth)}
      </span>
      <span className="sms-bulk-compact-row__cell sms-bulk-person-row__phone">{phoneDisplay}</span>
      {showStatus ? (
        <span
          className={`sms-bulk-compact-row__cell sms-bulk-person-row__status sms-bulk-compact-row__status${
            canSend ? ' sms-bulk-compact-row__status--ok' : ' sms-bulk-compact-row__status--blocked'
          }`}
        >
          {formatSmsBlockedReason(canSend ? null : blockedReason ?? null)}
        </span>
      ) : null}
    </>
  )
}

export default function SmsBulkPersonRow({
  layout,
  compactBirth = layout === 'pc',
  disabled,
  checked,
  onCheckChange,
  showStatus = false,
  onRemove,
  removeLabel = '제거',
  canSend,
  blockedReason,
  ...person
}: BaseProps) {
  const rowClassName = `sms-bulk-compact-row sms-bulk-person-row sms-bulk-compact-row--${layout}${
    onRemove ? ' sms-bulk-person-row--with-action' : ''
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
    <PersonRowCells
      {...person}
      compactBirth={compactBirth}
      showStatus={showStatus}
      canSend={canSend}
      blockedReason={blockedReason}
    />
  )

  const removeButton =
    onRemove != null ? (
      <FormButton
        type="button"
        variant="secondary"
        className="sms-bulk-compact-row__action sms-bulk-person-row__remove"
        disabled={disabled}
        onClick={onRemove}
      >
        {removeLabel}
      </FormButton>
    ) : null

  if (onRemove == null) {
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