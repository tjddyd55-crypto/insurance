import FormInput from '../../../components/form/FormInput'

export type CustomerDrivingRadioGroupProps = {
  /** 미선택(null)은 저장 전 검증에서 막으며, UI에는 운전함/운전안함만 제공 */
  value: boolean | null
  onChange: (next: boolean) => void
  name: string
  disabled?: boolean
}

export function CustomerDrivingRadioGroup({
  value,
  onChange,
  name,
  disabled,
}: CustomerDrivingRadioGroupProps) {
  return (
    <div className="customer-driving-radio-group" role="radiogroup" aria-label="운전 여부">
      <label className="customer-driving-radio-option">
        <FormInput
          type="radio"
          name={name}
          className="customer-driving-radio-option__input"
          checked={value === true}
          disabled={disabled}
          onChange={() => onChange(true)}
        />
        <span className="customer-driving-radio-option__label">운전함</span>
      </label>
      <label className="customer-driving-radio-option">
        <FormInput
          type="radio"
          name={name}
          className="customer-driving-radio-option__input"
          checked={value === false}
          disabled={disabled}
          onChange={() => onChange(false)}
        />
        <span className="customer-driving-radio-option__label">운전안함</span>
      </label>
    </div>
  )
}
