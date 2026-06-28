import { FormInput, FormSelect, FormTextarea } from '../../../components/form'
import type { ClaimCompany } from '../api/claimRequestsApi'
import { getExtraFieldsForCompany } from '../config/claimCompanyExtraFields.config'
import type { CompanySpecificFields } from '../utils/claimCompanyValidation'

type Props = {
  selectedCompanies: ClaimCompany[]
  companySpecificFields: CompanySpecificFields
  onFieldChange: (companyId: string, fieldKey: string, value: string) => void
  disabled?: boolean
}

function renderFieldInput(
  field: ReturnType<typeof getExtraFieldsForCompany>[number],
  value: string,
  disabled: boolean,
  onChange: (next: string) => void,
) {
  if (field.type === 'textarea') {
    return (
      <FormTextarea
        value={value}
        disabled={disabled}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  if (field.type === 'select') {
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
      type={field.type === 'date' ? 'date' : 'text'}
      value={value}
      disabled={disabled}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export default function ClaimCompanyExtraFieldsPanel({
  selectedCompanies,
  companySpecificFields,
  onFieldChange,
  disabled = false,
}: Props) {
  if (selectedCompanies.length === 0) {
    return (
      <section className="claim-company-extra-fields claim-company-extra-fields--empty">
        <h3 className="claim-company-extra-fields__title">선택한 보험회사 추가정보</h3>
        <p className="insurance-claim-form__hint">보험회사를 선택하면 추가 입력 항목이 표시됩니다.</p>
      </section>
    )
  }

  return (
    <section className="claim-company-extra-fields">
      <h3 className="claim-company-extra-fields__title">선택한 보험회사 추가정보</h3>
      <div className="claim-company-extra-fields__list">
        {selectedCompanies.map((company) => {
          const companyId = String(company.id)
          const fields = getExtraFieldsForCompany(company)
          const values = companySpecificFields[companyId] ?? {}

          return (
            <article key={company.id} className="claim-company-extra-fields__block">
              <h4 className="claim-company-extra-fields__company-name">{company.companyName}</h4>
              {fields.length === 0 ? (
                <p className="claim-company-extra-fields__empty">추가 입력 정보 없음</p>
              ) : (
                fields.map((field) => (
                  <label key={field.key} className="insurance-claim-form__field">
                    <span className="insurance-claim-form__label">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                    {renderFieldInput(field, values[field.key] ?? '', disabled, (next) =>
                      onFieldChange(companyId, field.key, next),
                    )}
                  </label>
                ))
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
