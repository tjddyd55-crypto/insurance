import { useMemo } from 'react'
import type { ClaimCompany } from '../api/claimRequestsApi'
import { splitClaimCompaniesByGroup } from '../claimCompanyGroups'

type Props = {
  companies: ClaimCompany[]
  selectedCompanyIds: string[]
  onToggle: (companyId: string) => void
  disabled?: boolean
  multiSelect?: boolean
}

function CompanyGroupColumn({
  title,
  companies,
  selectedCompanyIds,
  onToggle,
  disabled,
}: {
  title: string
  companies: ClaimCompany[]
  selectedCompanyIds: string[]
  onToggle: (companyId: string) => void
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
            const selected = selectedCompanyIds.includes(id)
            return (
              <button
                key={company.id}
                type="button"
                aria-pressed={selected}
                className={`claim-company-option${selected ? ' is-selected' : ''}`}
                disabled={disabled}
                onClick={() => onToggle(id)}
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
  selectedCompanyIds,
  onToggle,
  disabled = false,
  multiSelect = true,
}: Props) {
  const { life, nonLife } = useMemo(() => splitClaimCompaniesByGroup(companies), [companies])
  const selectedCount = selectedCompanyIds.length

  return (
    <aside className="insurance-claim-company-panel">
      <div className="insurance-claim-company-panel__inner claim-form-section">
        <h2 className="insurance-claim-company-panel__title">보험회사 선택</h2>
        <p className="insurance-claim-company-panel__desc">
          {multiSelect ? '청구할 보험회사를 하나 이상 선택하세요.' : '청구할 보험회사를 선택하세요.'}
        </p>
        {selectedCount > 0 ? (
          <p className="insurance-claim-company-panel__selection-count">선택됨 {selectedCount}건</p>
        ) : null}
        <div className="claim-company-groups">
          <CompanyGroupColumn
            title="생명보험"
            companies={life}
            selectedCompanyIds={selectedCompanyIds}
            onToggle={onToggle}
            disabled={disabled}
          />
          <CompanyGroupColumn
            title="손해보험"
            companies={nonLife}
            selectedCompanyIds={selectedCompanyIds}
            onToggle={onToggle}
            disabled={disabled}
          />
        </div>
        {selectedCount === 0 ? (
          <p className="insurance-claim-company-panel__hint">보험회사를 선택해 주세요.</p>
        ) : null}
      </div>
    </aside>
  )
}
