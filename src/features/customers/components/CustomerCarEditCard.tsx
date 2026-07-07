import { FormButton, FormInput } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import type { CustomerCarFormItem } from '../types/customerCarForm'
import { toDateInputValue } from '../utils/toDateInputValue'

export type CustomerCarEditCardProps = {
  index: number
  car: CustomerCarFormItem
  canRemove: boolean
  disabled?: boolean
  onChange: (next: CustomerCarFormItem) => void
  onRemove: () => void
}

export function CustomerCarEditCard({
  index,
  car,
  canRemove,
  disabled,
  onChange,
  onRemove,
}: CustomerCarEditCardProps) {
  const n = index + 1
  return (
    <section className="customer-car-edit-card" aria-label={`자동차 정보 ${n}`}>
      <div className="customer-car-edit-card__header">
        <h4 className="customer-car-edit-card__title">자동차 정보 {n}</h4>
        {canRemove ? (
          <FormButton
            htmlType="button"
            className="customer-car-edit-card__remove"
            variant="secondary"
            disabled={disabled}
            onClick={onRemove}
          >
            삭제
          </FormButton>
        ) : null}
      </div>
      <label className="field">
        <span className="field__label">차량번호</span>
        <FormInput
          className="field__control"
          placeholder="차량번호"
          value={car.carNumber}
          disabled={disabled}
          onChange={(e) => onChange({ ...car, carNumber: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">차종(차량)</span>
        <FormInput
          className="field__control"
          placeholder="예: 그랜저, 카니발"
          value={car.carModel}
          disabled={disabled}
          onChange={(e) => onChange({ ...car, carModel: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">연식</span>
        <FormInput
          className="field__control"
          placeholder="연식"
          value={car.carYear}
          disabled={disabled}
          onChange={(e) => onChange({ ...car, carYear: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">만기(갱신)일</span>
        <AppDateInput
          className="field__control"
          value={toDateInputValue(car.renewalDate)}
          disabled={disabled}
          onChange={(renewalDate) => onChange({ ...car, renewalDate })}
        />
      </label>
    </section>
  )
}
