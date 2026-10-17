type Props = {
  label: string
  hint: string
  placeholder: string
  value: string
  visible: boolean
  maxLength?: number
  onChange: (value: string) => void
  onToggleVisible: () => void
}

export function AdvisorHeroEditorField({
  label,
  hint,
  placeholder,
  value,
  visible,
  maxLength,
  onChange,
  onToggleVisible,
}: Props) {
  return (
    <label className="pap-hero-editor-field">
      <span className="pap-hero-editor-field__label">{label}</span>
      <span className="pap-editor-field-hint">{hint}</span>
      <div className="pap-hero-editor-field__row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={!visible}
          aria-disabled={!visible}
        />
        <button type="button" className="pap-btn pap-btn--secondary pap-hero-editor-field__toggle" onClick={onToggleVisible}>
          {visible ? '비노출' : '노출'}
        </button>
      </div>
    </label>
  )
}
