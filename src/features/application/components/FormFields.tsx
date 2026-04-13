import type { HTMLAttributes, KeyboardEventHandler, ReactNode } from 'react'

interface BaseFieldProps {
  label: string
  required?: boolean
  helperText?: string
}

interface TextInputProps extends BaseFieldProps {
  value: string
  onChange: (nextValue: string) => void
  placeholder?: string
  type?: 'text' | 'date'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  disabled?: boolean
  readOnly?: boolean
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
}

interface TextAreaProps extends BaseFieldProps {
  value: string
  onChange: (nextValue: string) => void
  placeholder?: string
  disabled?: boolean
}

interface SelectInputProps extends BaseFieldProps {
  value: string
  options: readonly string[]
  onChange: (nextValue: string) => void
  placeholder?: string
  disabled?: boolean
}

interface CheckboxProps extends BaseFieldProps {
  checked: boolean
  onChange: (nextChecked: boolean) => void
  disabled?: boolean
}

interface FieldContainerProps extends BaseFieldProps {
  children: ReactNode
}

function FieldContainer({
  label,
  required = false,
  helperText,
  children,
}: FieldContainerProps) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {required ? <em className="field__required">*</em> : null}
      </span>
      {children}
      {helperText ? <small className="field__helper">{helperText}</small> : null}
    </label>
  )
}

export function TextInput({
  label,
  required,
  helperText,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  disabled,
  readOnly = false,
  onKeyDown,
}: TextInputProps) {
  const stateClassName = disabled || readOnly ? 'field--readonly' : 'field--editable'
  return (
    <FieldContainer label={label} required={required} helperText={helperText}>
      <input
        className={`field__control ${stateClassName}`}
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
      />
    </FieldContainer>
  )
}

export function TextAreaInput({
  label,
  required,
  helperText,
  value,
  onChange,
  placeholder,
  disabled,
}: TextAreaProps) {
  const stateClassName = disabled ? 'field--readonly' : 'field--editable'
  return (
    <FieldContainer label={label} required={required} helperText={helperText}>
      <textarea
        className={`field__control field__control--textarea ${stateClassName}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </FieldContainer>
  )
}

export function SelectInput({
  label,
  required,
  helperText,
  value,
  options,
  onChange,
  placeholder = '선택',
  disabled,
}: SelectInputProps) {
  const stateClassName = disabled ? 'field--readonly' : 'field--editable'
  return (
    <FieldContainer label={label} required={required} helperText={helperText}>
      <select
        className={`field__control ${stateClassName}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldContainer>
  )
}

export function CheckboxInput({
  label,
  helperText,
  checked,
  onChange,
  disabled,
}: CheckboxProps) {
  return (
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="checkbox-field__content">
        <strong>{label}</strong>
        {helperText ? <small>{helperText}</small> : null}
      </span>
    </label>
  )
}
