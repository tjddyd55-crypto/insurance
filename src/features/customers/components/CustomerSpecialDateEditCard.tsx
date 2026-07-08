import { memo, useCallback } from 'react'
import { FormButton, FormInput, FormSelect, FormTextarea } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import { CUSTOMER_SPECIAL_DATE_PURPOSE_OPTIONS } from '../config/customerSpecialDatePurpose.config'
import type { CustomerSpecialDateFormItem } from '../types/customerSpecialDateForm'
import type { CustomerSpecialDatePurposeType } from '../types/customerSpecialDateForm'

export type CustomerSpecialDateEditCardProps = {
  index: number
  item: CustomerSpecialDateFormItem
  disabled?: boolean
  onChange: (next: CustomerSpecialDateFormItem) => void
  onRemove: () => void
}

export const CustomerSpecialDateEditCard = memo(function CustomerSpecialDateEditCard({
  index,
  item,
  disabled,
  onChange,
  onRemove,
}: CustomerSpecialDateEditCardProps) {
  const n = index + 1

  const updateField = useCallback(
    (patch: Partial<CustomerSpecialDateFormItem>) => {
      onChange({ ...item, ...patch })
    },
    [item, onChange],
  )

  return (
    <section className="customer-special-date-edit-card" aria-label={`기념일 ${n}`}>
      <div className="customer-special-date-edit-card__header">
        <h4 className="customer-special-date-edit-card__title">기념일 {n}</h4>
        <FormButton
          htmlType="button"
          className="customer-special-date-edit-card__remove"
          variant="secondary"
          disabled={disabled}
          onClick={onRemove}
        >
          삭제
        </FormButton>
      </div>
      <label className="field">
        <span className="field__label">타입</span>
        <FormSelect
          className="field__control"
          value={item.purposeType}
          disabled={disabled}
          onChange={(e) =>
            updateField({ purposeType: e.target.value as CustomerSpecialDatePurposeType })
          }
        >
          {CUSTOMER_SPECIAL_DATE_PURPOSE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </FormSelect>
      </label>
      <label className="field">
        <span className="field__label">라벨</span>
        <FormInput
          className="field__control"
          placeholder="예: 결혼기념일, 첫 계약일"
          value={item.title}
          disabled={disabled}
          onChange={(e) => updateField({ title: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">날짜</span>
        <AppDateInput
          className="field__control"
          value={item.dateValue}
          disabled={disabled}
          onChange={(dateValue) => updateField({ dateValue })}
        />
      </label>
      <label className="field field--wide">
        <span className="field__label">메모 (선택)</span>
        <FormTextarea
          className="field__control customer-form-textarea"
          rows={2}
          placeholder="내부 관리용 메모"
          value={item.memo ?? ''}
          disabled={disabled}
          onChange={(e) => updateField({ memo: e.target.value })}
        />
      </label>
    </section>
  )
})
