import type { ClaimCompany } from './api/claimRequestsApi'

export type ClaimCompanyGroupKey = 'life' | 'nonLife'

export function splitClaimCompaniesByGroup(companies: ClaimCompany[]) {
  const life: ClaimCompany[] = []
  const nonLife: ClaimCompany[] = []

  for (const company of companies) {
    if (company.companyType === 'life') {
      life.push(company)
      continue
    }
    nonLife.push(company)
  }

  return { life, nonLife }
}
