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
  const inputType = String(props.type ?? 'text').toLowerCase()
  const isFileInput = inputType === 'file'
  const isRadio = inputType === 'radio'
  const isCheckbox = inputType === 'checkbox'
  const isChoiceControl = isRadio || isCheckbox
  /*
   * radio/checkbox 는 텍스트 입력 SSOT(.form-input 48px)와 분리한다.
   * choice 컨트롤에 field--editable border 를 붙이면 원형/박스가 깨진다.
   */
  const controlClass = isRadio ? 'form-radio' : isCheckbox ? 'form-checkbox' : 'form-input'
  const toneClass = isChoiceControl ? '' : readOnly || disabled ? 'field--readonly' : 'field--editable'
  const mergedClassName = [controlClass, toneClass, className].filter(Boolean).join(' ')
  const omitValueProp = isCheckbox || isFileInput || isRadio
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
