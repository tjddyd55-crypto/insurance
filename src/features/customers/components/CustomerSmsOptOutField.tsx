type CustomerSmsOptOutFieldProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function CustomerSmsOptOutField({
  checked,
  onChange,
  disabled = false,
  className = '',
}: CustomerSmsOptOutFieldProps) {
  return (
    <div className={`customer-sms-opt-out-field field field--wide${className ? ` ${className}` : ''}`}>
      <label className="customer-sms-opt-out-field__checkbox">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>문자 수신거부</span>
      </label>
      <p className="customer-sms-opt-out-field__hint">
        체크하면 단체문자, 예약문자, 자동문자 대상에서 제외됩니다.
      </p>
    </div>
  )
}
