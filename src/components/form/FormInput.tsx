import type { ChangeEventHandler, InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value?: string | number | null
  onChange?: ChangeEventHandler<HTMLInputElement>
}

export default function FormInput({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  className = '',
  ...props
}: Props) {
  const toneClass = readOnly || disabled ? 'field--readonly' : 'field--editable'
  const mergedClassName = ['form-input', toneClass, className].filter(Boolean).join(' ')

  return (
    <input
      {...props}
      value={value ?? ''}
      onChange={onChange}
      readOnly={readOnly}
      disabled={disabled}
      className={mergedClassName}
    />
  )
}
