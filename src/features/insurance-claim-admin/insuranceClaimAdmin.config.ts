import type { InsuranceClaimCompanyType, InsuranceClaimDocumentType } from '../api/insuranceClaimAdminApi'

export const INSURANCE_CLAIM_COMPANY_TYPE_LABELS: Record<InsuranceClaimCompanyType, string> = {
  life: '생명보험사',
  non_life: '손해보험사',
  mutual: '공제',
  other: '기타',
}

export const INSURANCE_CLAIM_DOCUMENT_TYPE_LABELS: Record<InsuranceClaimDocumentType, string> = {
  claim_form: '청구서 PDF',
  consent_form: '동의서 PDF',
  extra_form: '추가서류 PDF',
}

export const INSURANCE_CLAIM_COMPANY_TYPE_ORDER: InsuranceClaimCompanyType[] = [
  'life',
  'non_life',
  'mutual',
  'other',
]

export function formatClaimSetupStatus(configured: boolean): string {
  return configured ? '완료' : '미완료'
}
