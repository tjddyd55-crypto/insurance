import type { HTMLAttributes, ReactNode } from 'react'

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
}

interface CheckboxProps extends BaseFieldProps {
  checked: boolean
  onChange: (nextChecked: boolean) => void
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
}: TextInputProps) {
  return (
    <FieldContainer label={label} required={required} helperText={helperText}>
      <input
        className="field__control"
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
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
  return (
    <FieldContainer label={label} required={required} helperText={helperText}>
      <textarea
        className="field__control field__control--textarea"
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
}: SelectInputProps) {
  return (
    <FieldContainer label={label} required={required} helperText={helperText}>
      <select
        className="field__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
}: CheckboxProps) {
  return (
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox-field__content">
        <strong>{label}</strong>
        {helperText ? <small>{helperText}</small> : null}
      </span>
    </label>
  )
}
