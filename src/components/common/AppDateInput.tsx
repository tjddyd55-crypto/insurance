import type { ChangeEvent, ClipboardEvent, InputHTMLAttributes } from 'react'
import FormInput from '../form/FormInput'
import { normalizeDateInput } from '../../utils/dateInput'

export type AppDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode' | 'maxLength'
> & {
  value?: string | null
  onChange: (value: string) => void
}

export default function AppDateInput({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  disabled,
  readOnly,
  className = '',
  onPaste,
  ...props
}: AppDateInputProps) {
  const displayValue = normalizeDateInput(value ?? '')

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(normalizeDateInput(event.target.value))
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    onChange(normalizeDateInput(event.clipboardData.getData('text')))
    onPaste?.(event)
  }

  return (
    <FormInput
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={className}
      value={displayValue}
      maxLength={10}
      disabled={disabled}
      readOnly={readOnly}
      onChange={handleChange}
      onPaste={handlePaste}
    />
  )
}

export { normalizeDateInput } from '../../utils/dateInput'
