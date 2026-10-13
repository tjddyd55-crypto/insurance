import { useAuth } from '../../auth/AuthProvider'
import { isGaMemberUser } from '../../entitlements/featureEntitlementPolicy'
import InsuranceCompanyContactsViewPage from '../../company-registry/pages/InsuranceCompanyContactsViewPage'

/**
 * 원수사 연락처 진입점 — GA·공용 모두 동일 조회 UI(company directory 카드).
 * 데이터 소유·등록 API는 ownershipMode 로 서버에서 분리한다.
 */
export function InsurerContactsEntryPage() {
  const { user } = useAuth()
  const ownershipMode = isGaMemberUser(user) ? 'ga' : 'personal'
  return <InsuranceCompanyContactsViewPage ownershipMode={ownershipMode} />
}

export default InsurerContactsEntryPage
