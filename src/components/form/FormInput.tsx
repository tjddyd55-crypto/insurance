import { forwardRef, type ChangeEventHandler, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value?: string | number | null
  onChange?: ChangeEventHandler<HTMLInputElement>
}

const FormInput = forwardRef<HTMLInputElement, Props>(function FormInput(
  {
    value,
    onChange,
    readOnly = false,
    disabled = false,
    className = '',
    ...props
  },
  ref,
) {
  const toneClass = readOnly || disabled ? 'field--readonly' : 'field--editable'
  const mergedClassName = ['form-input', toneClass, className].filter(Boolean).join(' ')
  const isFileInput = String(props.type ?? '').toLowerCase() === 'file'
  const normalizedValue = isFileInput ? value ?? undefined : value ?? ''

  return (
    <input
      ref={ref}
      {...props}
      value={normalizedValue}
      onChange={onChange}
      readOnly={readOnly}
      disabled={disabled}
      className={mergedClassName}
    />
  )
})

export default FormInput
