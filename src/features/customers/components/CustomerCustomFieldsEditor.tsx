import { useCallback } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import type { CustomerCustomFieldFormItem } from '../types/customerCustomFieldForm'
import {
  createEmptyCustomerCustomField,
  CUSTOMER_CUSTOM_FIELD_LABEL_MAX,
  CUSTOMER_CUSTOM_FIELD_VALUE_MAX,
} from '../utils/customerCustomFieldFormUtils'
import { CustomerFormSection } from './CustomerFormSection'

export type CustomerCustomFieldsEditorProps = {
  customFields: CustomerCustomFieldFormItem[]
  onChange: (next: CustomerCustomFieldFormItem[]) => void
  disabled?: boolean
}

export function CustomerCustomFieldsEditor({
  customFields,
  onChange,
  disabled,
}: CustomerCustomFieldsEditorProps) {
  const list = customFields

  const updateAt = useCallback(
    (i: number, next: CustomerCustomFieldFormItem) => {
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
    onChange([...list, createEmptyCustomerCustomField()])
  }, [list, onChange])

  return (
    <CustomerFormSection
      title="추가 정보"
      className="customer-form-section--grid-full customer-custom-fields-editor"
      headerExtra={
        <FormButton
          htmlType="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={addItem}
        >
          + 항목 추가
        </FormButton>
      }
    >
      {list.length === 0 ? (
        <p className="customer-custom-fields-editor__empty-hint">
          등록된 추가 정보가 없습니다. 항목 추가 버튼으로 입력하세요.
        </p>
      ) : (
        <div className="customer-custom-fields-editor__list">
          {list.map((item, i) => (
            <div
              key={item.id != null ? `id-${item.id}` : `idx-${i}`}
              className="customer-custom-fields-editor__row"
            >
              <label className="customer-custom-fields-editor__field">
                <span className="field__label">라벨</span>
                <FormInput
                  className="field__control"
                  value={item.label}
                  maxLength={CUSTOMER_CUSTOM_FIELD_LABEL_MAX}
                  disabled={disabled}
                  onChange={(e) => updateAt(i, { ...item, label: e.target.value })}
                />
              </label>
              <label className="customer-custom-fields-editor__field customer-custom-fields-editor__field--value">
                <span className="field__label">입력값</span>
                <FormInput
                  className="field__control"
                  value={item.value}
                  maxLength={CUSTOMER_CUSTOM_FIELD_VALUE_MAX}
                  disabled={disabled}
                  onChange={(e) => updateAt(i, { ...item, value: e.target.value })}
                />
              </label>
              <FormButton
                htmlType="button"
                variant="secondary"
                size="sm"
                className="customer-custom-fields-editor__remove"
                disabled={disabled}
                onClick={() => removeAt(i)}
              >
                삭제
              </FormButton>
            </div>
          ))}
        </div>
      )}
    </CustomerFormSection>
  )
}
