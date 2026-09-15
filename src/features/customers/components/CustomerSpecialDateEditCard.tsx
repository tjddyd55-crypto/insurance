import { memo, useCallback } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import AppDateInput from '../../../components/common/AppDateInput'
import type { CustomerSpecialDateFormItem } from '../types/customerSpecialDateForm'

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
    <section className="customer-special-date-edit-card" aria-label={`알림일 ${n}`}>
      <div className="customer-special-date-edit-card__header">
        <h4 className="customer-special-date-edit-card__title">알림일 {n}</h4>
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
        <span className="field__label">라벨</span>
        <FormInput
          className="field__control"
          placeholder="예: 자동차보험 갱신, 고객 연락 예정"
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
    </section>
  )
})
