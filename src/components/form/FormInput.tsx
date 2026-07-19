import { forwardRef, type ChangeEventHandler, type InputHTMLAttributes } from 'react'
import {
  applyFormInputFormat,
  PHONE_INPUT_MAX_LENGTH,
  PHONE_INPUT_PLACEHOLDER,
  RESIDENT_NUMBER_INPUT_MAX_LENGTH,
  RESIDENT_NUMBER_INPUT_PLACEHOLDER,
  type FormInputFormat,
} from '../../utils/inputFormatters'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value?: string | number | null
  onChange?: ChangeEventHandler<HTMLInputElement>
  /** 휴대폰·주민번호 자동 하이픈. 표시용 format이며 저장 정책은 호출측에서 유지한다. */
  format?: FormInputFormat
}

const FormInput = forwardRef<HTMLInputElement, Props>(function FormInput(
  {
    value,
    onChange,
    format,
    readOnly = false,
    disabled = false,
    className = '',
    inputMode,
    autoComplete,
    placeholder,
    maxLength,
    ...props
  },
  ref,
) {
  const toneClass = readOnly || disabled ? 'field--readonly' : 'field--editable'
  const mergedClassName = ['form-input', toneClass, className].filter(Boolean).join(' ')
  const inputType = String(props.type ?? '').toLowerCase()
  const isFileInput = inputType === 'file'
  const isCheckbox = inputType === 'checkbox'
  const omitValueProp = isCheckbox || isFileInput
  const rawValue = value ?? ''
  const normalizedValue =
    format && !omitValueProp ? applyFormInputFormat(format, String(rawValue)) : rawValue

  const formatDefaults =
    format === 'phone'
      ? {
          inputMode: 'numeric' as const,
          autoComplete: 'tel',
          placeholder: PHONE_INPUT_PLACEHOLDER,
          maxLength: PHONE_INPUT_MAX_LENGTH,
        }
      : format === 'residentNumber'
        ? {
            inputMode: 'numeric' as const,
            autoComplete: 'off',
            placeholder: RESIDENT_NUMBER_INPUT_PLACEHOLDER,
            maxLength: RESIDENT_NUMBER_INPUT_MAX_LENGTH,
          }
        : null

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (!format || !onChange) {
      onChange?.(event)
      return
    }
    const next = applyFormInputFormat(format, event.target.value)
    event.target.value = next
    onChange(event)
  }

  return (
    <input
      ref={ref}
      {...props}
      inputMode={inputMode ?? formatDefaults?.inputMode}
      autoComplete={autoComplete ?? formatDefaults?.autoComplete}
      placeholder={placeholder ?? formatDefaults?.placeholder}
      maxLength={maxLength ?? formatDefaults?.maxLength}
      {...(!omitValueProp ? { value: normalizedValue } : {})}
      onChange={handleChange}
      readOnly={readOnly}
      disabled={disabled}
      className={mergedClassName}
    />
  )
})

export default FormInput
export type { FormInputFormat }
