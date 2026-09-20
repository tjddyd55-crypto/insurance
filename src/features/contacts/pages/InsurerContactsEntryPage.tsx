import { useAuth } from '../../auth/AuthProvider'
import { isGaMemberUser } from '../../entitlements/featureEntitlementPolicy'
import InsuranceCompanyContactsViewPage from '../../company-registry/pages/InsuranceCompanyContactsViewPage'
import { ReinsurerContactsPage } from './ReinsurerContactsPage'

/**
 * 원수사 연락처 진입점 — affiliation 에 따라 source 를 전환한다.
 * GA MEMBER: GA 공용 company directory
 * GENERAL: 개인 insurance_contacts (CRUD)
 */
export function InsurerContactsEntryPage() {
  const { user } = useAuth()
  if (isGaMemberUser(user)) {
    return <InsuranceCompanyContactsViewPage />
  }
  return <ReinsurerContactsPage mode="personal" />
}

export default InsurerContactsEntryPage
