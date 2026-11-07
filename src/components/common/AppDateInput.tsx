import { useRef, type ChangeEvent, type ClipboardEvent, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent } from 'react'
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
  /**
   * text: YYYY-MM-DD 직접 입력 + 달력 버튼 (기본).
   * picker: 숫자 입력 없이 칸·달력 버튼을 누르면 네이티브 달력만 연다.
   */
  entry?: 'text' | 'picker'
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
  entry = 'text',
  onClick,
  onKeyDown,
  ...props
}: AppDateInputProps) {
  const nativeDateRef = useRef<HTMLInputElement>(null)
  const pickerEntry = entry === 'picker'
  const displayValue = pickerEntry ? coerceStoredDateValue(value ?? '') : normalizeDateInput(value ?? '')
  const nativeValue = isValidDateString(displayValue)
    ? displayValue
    : coerceStoredDateValue(value ?? '')

  const openPicker = () => {
    openNativeDatePicker(nativeDateRef.current, { disabled, readOnly: pickerEntry ? false : readOnly })
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (pickerEntry) return
    onChange(normalizeDateInput(event.target.value))
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (pickerEntry) {
      event.preventDefault()
      return
    }
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

  const handleClick = (event: MouseEvent<HTMLInputElement>) => {
    onClick?.(event)
    if (pickerEntry) openPicker()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (!pickerEntry || event.defaultPrevented) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  const pickerDisabled = Boolean(disabled || (!pickerEntry && readOnly))
  const mergedInputClassName = ['app-date-input__text', inputClassName || className].filter(Boolean).join(' ')

  return (
    <div className={['app-date-input', pickerEntry ? 'app-date-input--picker' : '', wrapperClassName].filter(Boolean).join(' ')}>
      <FormInput
        {...props}
        type="text"
        inputMode={pickerEntry ? undefined : 'numeric'}
        autoComplete="off"
        placeholder={placeholder}
        className={mergedInputClassName}
        value={displayValue}
        maxLength={10}
        disabled={disabled}
        readOnly={pickerEntry || readOnly}
        onChange={handleChange}
        onPaste={handlePaste}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />

      <button
        type="button"
        className="app-date-input__button"
        onClick={openPicker}
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
