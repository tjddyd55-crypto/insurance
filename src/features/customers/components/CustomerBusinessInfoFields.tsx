import { FormInput, FormTextarea } from '../../../components/form'
import type { CustomerBusinessInfo } from '../domain/customerBusinessInfo'
import { CustomerFormSection } from './CustomerFormSection'

export type CustomerBusinessInfoFieldsProps = {
  value: CustomerBusinessInfo
  onChange: (next: CustomerBusinessInfo) => void
  disabled?: boolean
}

export function CustomerBusinessInfoFields({
  value,
  onChange,
  disabled,
}: CustomerBusinessInfoFieldsProps) {
  const update = (patch: Partial<CustomerBusinessInfo>) => {
    onChange({ ...value, ...patch })
  }

  return (
    <CustomerFormSection title="사업자 정보" className="customer-form-section--grid-full">
      <label className="field">
        <span className="field__label">대표자명</span>
        <FormInput
          className="field__control"
          value={value.representativeName}
          disabled={disabled}
          onChange={(e) => update({ representativeName: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">사업자번호</span>
        <FormInput
          className="field__control"
          value={value.businessNumber}
          disabled={disabled}
          inputMode="numeric"
          placeholder="000-00-00000"
          onChange={(e) => update({ businessNumber: e.target.value })}
        />
      </label>
      <label className="field field--wide">
        <span className="field__label">사업장 주소</span>
        <FormInput
          className="field__control"
          value={value.businessAddress}
          disabled={disabled}
          onChange={(e) => update({ businessAddress: e.target.value })}
        />
      </label>
      <label className="field field--wide">
        <span className="field__label">메모</span>
        <FormTextarea
          className="field__control customer-form-textarea"
          rows={3}
          value={value.memo}
          disabled={disabled}
          onChange={(e) => update({ memo: e.target.value })}
        />
      </label>
    </CustomerFormSection>
  )
}
