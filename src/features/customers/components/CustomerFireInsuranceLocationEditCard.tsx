import { memo, useCallback } from 'react'
import {
  AddressSearchField,
  FormButton,
  FormTextarea,
  formatAddressForSave,
  parseAddressFromSave,
} from '../../../components/form'
import type { CustomerFireInsuranceLocationFormItem } from '../types/customerFireInsuranceLocationForm'

export type CustomerFireInsuranceLocationEditCardProps = {
  index: number
  item: CustomerFireInsuranceLocationFormItem
  disabled?: boolean
  onChange: (next: CustomerFireInsuranceLocationFormItem) => void
  onRemove: () => void
}

export const CustomerFireInsuranceLocationEditCard = memo(function CustomerFireInsuranceLocationEditCard({
  index,
  item,
  disabled,
  onChange,
  onRemove,
}: CustomerFireInsuranceLocationEditCardProps) {
  const n = index + 1

  const updateField = useCallback(
    (patch: Partial<CustomerFireInsuranceLocationFormItem>) => {
      onChange({ ...item, ...patch })
    },
    [item, onChange],
  )

  return (
    <section className="customer-fire-location-edit-card" aria-label={`소재지 ${n}`}>
      <div className="customer-fire-location-edit-card__header">
        <h4 className="customer-fire-location-edit-card__title">소재지 {n}</h4>
        <FormButton
          htmlType="button"
          className="customer-fire-location-edit-card__remove"
          variant="secondary"
          disabled={disabled}
          onClick={onRemove}
        >
          삭제
        </FormButton>
      </div>
      <div className="field field--wide">
        <span className="field__label">주소</span>
        <AddressSearchField
          className="address-search-field"
          value={parseAddressFromSave(item.address)}
          disabled={disabled}
          onChange={(next) => updateField({ address: formatAddressForSave(next) })}
        />
      </div>
      <label className="field field--wide">
        <span className="field__label">메모</span>
        <FormTextarea
          className="field__control customer-form-textarea"
          rows={3}
          value={item.memo}
          disabled={disabled}
          onChange={(e) => updateField({ memo: e.target.value })}
        />
      </label>
    </section>
  )
})
