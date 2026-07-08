import { useRef, type ChangeEvent, type ClipboardEvent, InputHTMLAttributes } from 'react'
import FormInput from '../form/FormInput'
import { coerceStoredDateValue, isValidDateString, normalizeDateInput } from '../../utils/dateInput'

export type AppDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode' | 'maxLength'
> & {
  value?: string | null
  onChange: (value: string) => void
  wrapperClassName?: string
  inputClassName?: string
}

export function openNativeDatePicker(
  input: HTMLInputElement | null,
  options?: { disabled?: boolean; readOnly?: boolean },
) {
  if (options?.disabled || options?.readOnly || !input) {
    return
  }
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
      return
    } catch {
      // Safari 등 일부 환경에서 showPicker가 throw 할 수 있음
    }
  }
  input.click()
}

function AppDateInputCalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default function AppDateInput({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  disabled,
  readOnly,
  className = '',
  wrapperClassName = '',
  inputClassName = '',
  min,
  max,
  onPaste,
  ...props
}: AppDateInputProps) {
  const nativeDateRef = useRef<HTMLInputElement>(null)
  const displayValue = normalizeDateInput(value ?? '')
  const nativeValue = isValidDateString(displayValue)
    ? displayValue
    : coerceStoredDateValue(value ?? '')

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(normalizeDateInput(event.target.value))
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    onChange(normalizeDateInput(event.clipboardData.getData('text')))
    onPaste?.(event)
  }

  const handleNativeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    if (next) {
      onChange(next)
    }
  }

  const pickerDisabled = Boolean(disabled || readOnly)
  const mergedInputClassName = ['app-date-input__text', inputClassName || className].filter(Boolean).join(' ')

  return (
    <div className={['app-date-input', wrapperClassName].filter(Boolean).join(' ')}>
      <FormInput
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={mergedInputClassName}
        value={displayValue}
        maxLength={10}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleChange}
        onPaste={handlePaste}
      />

      <button
        type="button"
        className="app-date-input__button"
        onClick={() => openNativeDatePicker(nativeDateRef.current, { disabled, readOnly })}
        disabled={pickerDisabled}
        aria-label="날짜 선택"
        tabIndex={-1}
      >
        <AppDateInputCalendarIcon />
      </button>

      <input
        ref={nativeDateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={nativeValue}
        min={min}
        max={max}
        disabled={pickerDisabled}
        onChange={handleNativeChange}
        className="app-date-input__native"
      />
    </div>
  )
}

export { normalizeDateInput } from '../../utils/dateInput'
