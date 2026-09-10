import { useCallback } from 'react'
import { FormButton } from '../../../components/form'
import type { CustomerFireInsuranceLocationFormItem } from '../types/customerFireInsuranceLocationForm'
import { createEmptyCustomerFireInsuranceLocation } from '../utils/customerFireInsuranceLocationFormUtils'
import { CustomerFormSection } from './CustomerFormSection'
import { CustomerFireInsuranceLocationEditCard } from './CustomerFireInsuranceLocationEditCard'

export type CustomerFireInsuranceLocationsEditorProps = {
  locations: CustomerFireInsuranceLocationFormItem[]
  onChange: (next: CustomerFireInsuranceLocationFormItem[]) => void
  disabled?: boolean
}

export function CustomerFireInsuranceLocationsEditor({
  locations,
  onChange,
  disabled,
}: CustomerFireInsuranceLocationsEditorProps) {
  const list = locations

  const updateAt = useCallback(
    (i: number, next: CustomerFireInsuranceLocationFormItem) => {
      const copy = [...list]
      copy[i] = next
      onChange(copy)
    },
    [list, onChange],
  )

  const removeAt = useCallback(
    (i: number) => {
      const next = list.filter((_, j) => j !== i)
      onChange(next.length > 0 ? next : [createEmptyCustomerFireInsuranceLocation()])
    },
    [list, onChange],
  )

  const addItem = useCallback(() => {
    onChange([...list, createEmptyCustomerFireInsuranceLocation()])
  }, [list, onChange])

  return (
    <CustomerFormSection
      title="화재보험 정보"
      className="customer-form-section--grid-full customer-fire-locations-editor"
    >
      <div className="customer-fire-locations-editor__list">
        {list.map((item, i) => (
          <CustomerFireInsuranceLocationEditCard
            key={item.id != null ? `id-${item.id}` : `idx-${i}`}
            index={i}
            item={item}
            disabled={disabled}
            onChange={(next) => updateAt(i, next)}
            onRemove={() => removeAt(i)}
          />
        ))}
      </div>
      <FormButton
        htmlType="button"
        variant="secondary"
        className="customer-fire-locations-editor__add"
        disabled={disabled}
        onClick={addItem}
      >
        + 소재지 추가
      </FormButton>
    </CustomerFormSection>
  )
}
