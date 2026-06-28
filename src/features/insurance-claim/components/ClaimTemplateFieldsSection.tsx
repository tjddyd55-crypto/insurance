import { FormInput, FormSelect, FormTextarea } from '../../../components/form'
import type { ClaimDocumentFieldSpec } from '../api/claimRequestsApi'
import { claimDataKeyFromFieldKey } from '../utils/claimTemplateFormFields'

type Props = {
  fields: ClaimDocumentFieldSpec[]
  claimData: Record<string, string>
  disabled?: boolean
  onFieldChange: (dataKey: string, value: string) => void
}

function renderFieldInput(
  field: ClaimDocumentFieldSpec,
  value: string,
  disabled: boolean,
  onChange: (next: string) => void,
) {
  const fieldType = String(field.fieldType ?? 'text')
  if (fieldType === 'textarea') {
    return (
      <FormTextarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
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
  return (
    <FormInput
      type={fieldType === 'date' ? 'date' : 'text'}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export default function ClaimTemplateFieldsSection({
  fields,
  claimData,
  disabled = false,
  onFieldChange,
}: Props) {
  if (fields.length === 0) {
    return null
  }

  return (
    <section className="insurance-claim-form__section claim-form-section">
      <h2>청구서 추가 입력</h2>
      <p className="insurance-claim-form__section-desc">
        선택한 보험회사 청구서 PDF 좌표 설정에 따라 필요한 항목만 표시됩니다.
      </p>
      <div className="insurance-claim-form__field-grid">
        {fields.map((field) => {
          const dataKey = claimDataKeyFromFieldKey(field.fieldKey)
          return (
            <label key={field.fieldKey} className="insurance-claim-form__field">
              <span className="insurance-claim-form__label">
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              {renderFieldInput(field, claimData[dataKey] ?? '', disabled, (next) => onFieldChange(dataKey, next))}
            </label>
          )
        })}
      </div>
    </section>
  )
}
