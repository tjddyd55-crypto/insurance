import { useCallback } from 'react'
import { FormButton } from '../../../components/form'
import type { CustomerSpecialDateFormItem } from '../types/customerSpecialDateForm'
import { createEmptyCustomerSpecialDate } from '../utils/customerSpecialDateFormUtils'
import { CustomerFormSection } from './CustomerFormSection'
import { CustomerSpecialDateEditCard } from './CustomerSpecialDateEditCard'

export type CustomerSpecialDatesEditorProps = {
  specialDates: CustomerSpecialDateFormItem[]
  onChange: (next: CustomerSpecialDateFormItem[]) => void
  disabled?: boolean
}

export function CustomerSpecialDatesEditor({
  specialDates,
  onChange,
  disabled,
}: CustomerSpecialDatesEditorProps) {
  const list = specialDates

  const updateAt = useCallback(
    (i: number, next: CustomerSpecialDateFormItem) => {
      const copy = [...list]
      copy[i] = next
      onChange(copy)
    },
    [list, onChange],
  )

  const removeAt = useCallback(
    (i: number) => {
      onChange(list.filter((_, j) => j !== i))
    },
    [list, onChange],
  )

  const addItem = useCallback(() => {
    onChange([...list, createEmptyCustomerSpecialDate()])
  }, [list, onChange])

  return (
    <CustomerFormSection
      title="기념일"
      className="customer-form-section--grid-full customer-special-dates-editor"
      headerExtra={
        <FormButton
          htmlType="button"
          className="customer-special-dates-editor__add-button filter-button"
          variant="secondary"
          disabled={disabled}
          onClick={addItem}
        >
          기념일 추가
        </FormButton>
      }
    >
      {list.length === 0 ? (
        <p className="customer-special-dates-editor__empty-hint">등록된 기념일이 없습니다. 추가 버튼으로 입력하세요.</p>
      ) : (
        <div className="customer-special-dates-editor__list">
          {list.map((item, i) => (
            <CustomerSpecialDateEditCard
              key={item.id != null ? `id-${item.id}` : `idx-${i}`}
              index={i}
              item={item}
              disabled={disabled}
              onChange={(next) => updateAt(i, next)}
              onRemove={() => removeAt(i)}
            />
          ))}
        </div>
      )}
    </CustomerFormSection>
  )
}
