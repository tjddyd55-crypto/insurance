import { memo, useCallback, type ChangeEvent } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import type { CustomerCarFormItem } from '../types/customerCarForm'

function normalizeCarYearInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4)
}

export type CustomerCarEditCardProps = {
  index: number
  car: CustomerCarFormItem
  canRemove: boolean
  disabled?: boolean
  onChange: (next: CustomerCarFormItem) => void
  onRemove: () => void
}

export const CustomerCarEditCard = memo(function CustomerCarEditCard({
  index,
  car,
  canRemove,
  disabled,
  onChange,
  onRemove,
}: CustomerCarEditCardProps) {
  const n = index + 1

  const updateField = useCallback(
    (patch: Partial<CustomerCarFormItem>) => {
      onChange({ ...car, ...patch })
    },
    [car, onChange],
  )

  const handleCarYearChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateField({ carYear: normalizeCarYearInput(event.target.value) })
    },
    [updateField],
  )

  const handleRenewalDateChange = useCallback(
    (renewalDate: string) => {
      updateField({ renewalDate })
    },
    [updateField],
  )

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
          onChange={(e) => updateField({ carNumber: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">차종(차량)</span>
        <FormInput
          className="field__control"
          placeholder="예: 그랜저, 카니발"
          value={car.carModel}
          disabled={disabled}
          onChange={(e) => updateField({ carModel: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">연식</span>
        <FormInput
          className="field__control"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="연식"
          value={car.carYear}
          disabled={disabled}
          onChange={handleCarYearChange}
        />
      </label>
      <label className="field">
        <span className="field__label">만기(갱신)일</span>
        <AppDateInput
          inputClassName="field__control"
          value={car.renewalDate ?? ''}
          disabled={disabled}
          onChange={handleRenewalDateChange}
        />
      </label>
    </section>
  )
})
