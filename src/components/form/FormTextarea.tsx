import type { ChangeEventHandler, TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value?: string | null
  onChange?: ChangeEventHandler<HTMLTextAreaElement>
}

export default function FormTextarea({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  className = '',
  ...props
}: Props) {
  const toneClass = readOnly || disabled ? 'field--readonly' : 'field--editable'
  const mergedClassName = ['form-textarea', toneClass, className].filter(Boolean).join(' ')

  return (
    <textarea
      {...props}
      value={value ?? ''}
      onChange={onChange}
      readOnly={readOnly}
      disabled={disabled}
      className={mergedClassName}
    />
  )
}
