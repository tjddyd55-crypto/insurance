import type { ChangeEventHandler, SelectHTMLAttributes } from 'react'

export type FormSelectOption = {
  value: string
  label: string
}

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'children'> & {
  value?: string | null
  onChange?: ChangeEventHandler<HTMLSelectElement>
  options?: FormSelectOption[]
}

export default function FormSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
  ...props
}: Props) {
  const toneClass = disabled ? 'field--readonly' : 'field--editable'
  const mergedClassName = ['form-select', toneClass, className].filter(Boolean).join(' ')

  return (
    <select
      {...props}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      className={mergedClassName}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
