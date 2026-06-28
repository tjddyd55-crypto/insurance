import { FormInput } from '../../../components/form'
import type { ClaimCompany } from '../api/claimRequestsApi'
import { splitClaimCompaniesByGroup } from '../claimCompanyGroups'

type Props = {
  companies: ClaimCompany[]
  selectedCompanyId: string | null
  onSelect: (companyId: string) => void
  faxNumber: string
  onFaxNumberChange: (value: string) => void
  disabled?: boolean
}

function CompanyGroupColumn({
  title,
  companies,
  selectedCompanyId,
  onSelect,
  disabled,
}: {
  title: string
  companies: ClaimCompany[]
  selectedCompanyId: string | null
  onSelect: (companyId: string) => void
  disabled: boolean
}) {
  return (
    <section className="claim-company-group" aria-label={title}>
      <h3 className="claim-company-group__title">{title}</h3>
      <div className="claim-company-group__list">
        {companies.length === 0 ? (
          <p className="claim-company-group__empty">등록된 보험회사가 없습니다.</p>
        ) : (
          companies.map((company) => {
            const id = String(company.id)
            const selected = selectedCompanyId === id
            return (
              <button
                key={company.id}
                type="button"
                aria-pressed={selected}
                className={`claim-company-option${selected ? ' is-selected' : ''}`}
                disabled={disabled}
                onClick={() => onSelect(id)}
              >
                {company.companyName}
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

export default function ClaimCompanyPickerPanel({
  companies,
  selectedCompanyId,
  onSelect,
  faxNumber,
  onFaxNumberChange,
  disabled = false,
}: Props) {
  const { life, nonLife } = splitClaimCompaniesByGroup(companies)
  const selectedCompany = companies.find((company) => String(company.id) === selectedCompanyId) ?? null

  return (
    <aside className="insurance-claim-company-panel">
      <div className="insurance-claim-company-panel__inner claim-form-section">
        <h2 className="insurance-claim-company-panel__title">보험회사 선택</h2>
        <p className="insurance-claim-company-panel__desc">청구할 보험회사를 하나 선택하세요.</p>
        <div className="claim-company-groups">
          <CompanyGroupColumn
            title="생명보험"
            companies={life}
            selectedCompanyId={selectedCompanyId}
            onSelect={onSelect}
            disabled={disabled}
          />
          <CompanyGroupColumn
            title="손해보험"
            companies={nonLife}
            selectedCompanyId={selectedCompanyId}
            onSelect={onSelect}
            disabled={disabled}
          />
        </div>
        {selectedCompanyId == null ? (
          <p className="insurance-claim-company-panel__hint">보험회사를 선택해 주세요.</p>
        ) : null}
      </div>

      {selectedCompany ? (
        <section className="claim-company-fax claim-form-section">
          <h3 className="claim-company-fax__title">청구 팩스번호</h3>
          {selectedCompany ? (
            <p className="claim-company-fax__company">{selectedCompany.companyName}</p>
          ) : null}
          <label className="insurance-claim-form__field">
            <span className="insurance-claim-form__label">팩스번호</span>
            <FormInput
              value={faxNumber}
              disabled={disabled}
              placeholder="예: 0505-123-4567"
              onChange={(event) => onFaxNumberChange(event.target.value)}
            />
          </label>
          <p className="insurance-claim-form__hint">
            보험회사에 저장된 청구 팩스번호를 기본값으로 불러옵니다. 필요하면 이번 청구에서만 수정해서 사용하세요.
          </p>
          <p className="insurance-claim-form__hint">팩스 발송 시 사용할 번호입니다. 번호가 없으면 팩스 발송 전 입력해야 합니다.</p>
        </section>
      ) : null}
    </aside>
  )
}
