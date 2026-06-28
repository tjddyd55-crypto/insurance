import { FormInput, FormSelect, FormTextarea } from '../../../components/form'
import type { ClaimTemplateFieldSpec } from '../utils/claimTemplateFormFields'
import ClaimRequestPersonCustomerSearch from './ClaimRequestPersonCustomerSearch'
import { resolveTemplateFieldType } from '../utils/claimTemplateFormFields'

type Props = {
  fields: ClaimTemplateFieldSpec[]
  loading?: boolean
  disabled?: boolean
  contractorSameAsInsured: boolean
  onContractorSameAsInsuredChange: (same: boolean) => void
  getFieldValue: (field: ClaimTemplateFieldSpec) => string
  onFieldChange: (field: ClaimTemplateFieldSpec, value: string) => void
  customerQuery: string
  customerMatches: Array<{ id: number; name: string; phone?: string }>
  onCustomerQueryChange: (value: string) => void
  onCustomerSearch: () => void
  onCustomerSelect: (customerId: number) => void
}

function ContractorSameControl({
  value,
  disabled,
  onChange,
}: {
  value: boolean
  disabled: boolean
  onChange: (same: boolean) => void
}) {
  return (
    <label className="insurance-claim-form__field insurance-claim-form__field--same claim-template-same-field">
      <span className="insurance-claim-form__label">계약자와 피보험자 동일 여부</span>
      <FormSelect
        value={value ? 'yes' : 'no'}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === 'yes')}
        options={[
          { value: 'yes', label: '예' },
          { value: 'no', label: '아니오' },
        ]}
      />
    </label>
  )
}

function renderFieldInput(
  field: ClaimTemplateFieldSpec,
  value: string,
  disabled: boolean,
  onChange: (next: string) => void,
) {
  const fieldType = resolveTemplateFieldType(field)

  if (fieldType === 'textarea') {
    return (
      <FormTextarea
        className="claim-template-field__textarea"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (fieldType === 'select') {
    return (
      <FormSelect
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        options={[
          { value: '', label: '선택' },
          ...(field.options ?? []).map((option) => ({ value: option.value, label: option.label })),
        ]}
      />
    )
  }

  if (fieldType === 'checkbox') {
    const checked = value === 'true' || value === '1' || value === 'yes'
    return (
      <label className="claim-template-field__checkbox">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
        />
        <span>{field.label}</span>
      </label>
    )
  }

  if (fieldType === 'radio') {
    const options = field.options ?? []
    if (options.length === 0) {
      return (
        <FormInput
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    }
    return (
      <div className="claim-template-field__radio-group">
        {options.map((option) => (
          <label key={option.value} className="claim-template-field__radio">
            <input
              type="radio"
              name={field.fieldKey}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    )
  }

  return (
    <FormInput
      type={fieldType === 'date' ? 'date' : 'text'}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function TemplateFieldGrid({
  fields,
  disabled,
  getFieldValue,
  onFieldChange,
}: Pick<Props, 'fields' | 'disabled' | 'getFieldValue' | 'onFieldChange'>) {
  if (fields.length === 0) {
    return (
      <p className="insurance-claim-form__hint">
        선택한 보험회사 청구서 좌표 설정에 등록된 입력 항목이 없습니다.
      </p>
    )
  }

  return (
    <div className="insurance-claim-form__field-grid claim-template-fields__grid">
      {fields.map((field) => {
        const fieldType = resolveTemplateFieldType(field)
        const value = getFieldValue(field)
        if (fieldType === 'checkbox') {
          return (
            <div key={field.fieldKey} className="insurance-claim-form__field claim-template-field">
              {renderFieldInput(field, value, disabled, (next) => onFieldChange(field, next))}
            </div>
          )
        }
        return (
          <label key={field.fieldKey} className="insurance-claim-form__field claim-template-field">
            <span className="insurance-claim-form__label">
              {field.label}
              {field.required ? ' *' : ''}
            </span>
            {renderFieldInput(field, value, disabled, (next) => onFieldChange(field, next))}
          </label>
        )
      })}
    </div>
  )
}

export default function ClaimTemplateFieldsSection({
  fields,
  loading = false,
  disabled = false,
  contractorSameAsInsured,
  onContractorSameAsInsuredChange,
  getFieldValue,
  onFieldChange,
  customerQuery,
  customerMatches,
  onCustomerQueryChange,
  onCustomerSearch,
  onCustomerSelect,
}: Props) {
  if (loading) {
    return (
      <section className="insurance-claim-form__section claim-form-section claim-template-fields">
        <h2>1. 청구 입력</h2>
        <p className="insurance-claim-form__hint">청구 입력 항목을 불러오는 중…</p>
      </section>
    )
  }

  return (
    <section className="insurance-claim-form__section claim-form-section claim-template-fields">
      <h2>1. 청구 입력</h2>
      <p className="insurance-claim-form__section-desc">
        선택한 보험회사 청구서 좌표 설정에 등록된 항목입니다.
      </p>
      <ClaimRequestPersonCustomerSearch
        query={customerQuery}
        matches={customerMatches}
        onQueryChange={onCustomerQueryChange}
        onSearch={onCustomerSearch}
        onSelect={onCustomerSelect}
      />
      <ContractorSameControl
        value={contractorSameAsInsured}
        disabled={disabled}
        onChange={onContractorSameAsInsuredChange}
      />
      <TemplateFieldGrid
        fields={fields}
        disabled={disabled}
        getFieldValue={getFieldValue}
        onFieldChange={onFieldChange}
      />
    </section>
  )
}
