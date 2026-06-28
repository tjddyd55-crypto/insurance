import type { ClaimCompany } from '../api/claimRequestsApi'
import { splitClaimCompaniesByGroup } from '../claimCompanyGroups'

type Props = {
  companies: ClaimCompany[]
  selectedCompanyId: string | null
  onSelect: (companyId: string) => void
  disabled?: boolean
}

function CompanyGroupBlock({
  title,
  modifier,
  companies,
  selectedCompanyId,
  onSelect,
  disabled,
}: {
  title: string
  modifier: 'life' | 'non-life'
  companies: ClaimCompany[]
  selectedCompanyId: string | null
  onSelect: (companyId: string) => void
  disabled: boolean
}) {
  return (
    <section
      className={`claim-company-group claim-company-group--${modifier}`}
      aria-label={title}
    >
      <header className="claim-company-group__header">
        <h3 className="claim-company-group__title">{title}</h3>
      </header>
      <div className="claim-company-group__body">
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
      </div>
    </section>
  )
}

export default function ClaimCompanyPickerPanel({
  companies,
  selectedCompanyId,
  onSelect,
  disabled = false,
}: Props) {
  const { life, nonLife } = splitClaimCompaniesByGroup(companies)

  return (
    <aside className="insurance-claim-company-panel">
      <div className="insurance-claim-company-panel__inner">
        <h2 className="insurance-claim-company-panel__title">보험회사 선택</h2>
        <p className="insurance-claim-company-panel__desc">청구할 보험회사를 하나 선택하세요.</p>
        <div className="claim-company-groups">
          <CompanyGroupBlock
            title="생명보험"
            modifier="life"
            companies={life}
            selectedCompanyId={selectedCompanyId}
            onSelect={onSelect}
            disabled={disabled}
          />
          <CompanyGroupBlock
            title="손해보험"
            modifier="non-life"
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
    </aside>
  )
}
