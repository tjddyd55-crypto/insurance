import type { ClaimCompany } from '../api/claimRequestsApi'

type Props = {
  companies: ClaimCompany[]
  selectedCompanyId: string
  onSelect: (companyId: string) => void
  disabled?: boolean
}

export default function ClaimCompanyPickerPanel({
  companies,
  selectedCompanyId,
  onSelect,
  disabled = false,
}: Props) {
  return (
    <aside className="insurance-claim-company-panel">
      <div className="insurance-claim-company-panel__inner claim-form-section">
        <h2 className="insurance-claim-company-panel__title">보험회사 선택</h2>
        <p className="insurance-claim-company-panel__desc">청구할 보험회사를 선택합니다.</p>
        <div className="claim-company-option-list" role="listbox" aria-label="보험회사">
          {companies.map((company) => {
            const id = String(company.id)
            const selected = selectedCompanyId === id
            return (
              <button
                key={company.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`claim-company-option${selected ? ' is-selected' : ''}`}
                disabled={disabled}
                onClick={() => onSelect(id)}
              >
                {company.companyName}
              </button>
            )
          })}
        </div>
        {!selectedCompanyId ? (
          <p className="insurance-claim-company-panel__hint">보험회사를 선택해 주세요.</p>
        ) : null}
      </div>
    </aside>
  )
}
