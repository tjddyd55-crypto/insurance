import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { CompanyList } from '../components/CompanyList'
import {
  getConsentGaIdForUser,
  MOCK_CONSENT_GA_ID,
  resolveConsentTemplateId,
} from '../domain/consentTemplateRegistry'
import { MOCK_LIFE_INSURERS, MOCK_NON_LIFE_INSURERS } from '../domain/mockCompanies'
import type { ConsentCompanyItem } from '../domain/types'
import '../consent.css'

export function ConsentCompanyPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const gaId = getConsentGaIdForUser(user)

  const handleSelect = (item: ConsentCompanyItem) => {
    const consentTemplateId = resolveConsentTemplateId(gaId, item.id)
    navigate('/internal/consent/form', {
      state: {
        gaId,
        insuranceCompanyId: item.id,
        insuranceCompanyName: item.name,
        consentTemplateId,
      },
    })
  }

  return (
    <main className="consent-flow">
      <PageBackButton />
      <div className="consent-flow__inner">
        <h1 className="consent-flow__title">보험사 선택</h1>
        <p className="consent-flow__ga-context">
          GA 기준 템플릿 · ga_id: <strong>{gaId}</strong>
          {user?.gaId == null ? ` (로그인 세션에 ga_id 없음 → 임시 ${MOCK_CONSENT_GA_ID})` : null}
        </p>
        <div className="consent-company-columns">
          <div className="consent-company-column">
            <CompanyList title="생명보험사" companies={MOCK_LIFE_INSURERS} onSelect={handleSelect} />
          </div>
          <div className="consent-company-column">
            <CompanyList title="손해보험사" companies={MOCK_NON_LIFE_INSURERS} onSelect={handleSelect} />
          </div>
        </div>
      </div>
    </main>
  )
}
