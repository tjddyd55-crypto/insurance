import type { ClaimCompany } from '../api/claimRequestsApi'
import { getExtraFieldsForCompany, type ClaimCompanyExtraFieldDef } from '../config/claimCompanyExtraFields.config'

export type SelectedClaimCompany = {
  companyId: string
  companyName: string
  companyType: ClaimCompany['companyType']
}

export type CompanySpecificFields = Record<string, Record<string, string>>

export function toSelectedClaimCompanies(companies: ClaimCompany[], selectedCompanyIds: string[]): SelectedClaimCompany[] {
  return selectedCompanyIds
    .map((companyId) => {
      const company = companies.find((row) => String(row.id) === companyId)
      if (!company) {
        return null
      }
      return {
        companyId,
        companyName: company.companyName,
        companyType: company.companyType,
      }
    })
    .filter((row): row is SelectedClaimCompany => row != null)
}

export function validateCompanySelection(selectedCompanyIds: string[]): string | null {
  if (selectedCompanyIds.length === 0) {
    return '보험회사를 하나 이상 선택해 주세요.'
  }
  return null
}

export function validateCompanySpecificFields(
  selectedCompanies: SelectedClaimCompany[],
  companySpecificFields: CompanySpecificFields,
): string | null {
  for (const company of selectedCompanies) {
    const fields = getExtraFieldsForCompany(company)
    const values = companySpecificFields[company.companyId] ?? {}
    for (const field of fields) {
      if (!field.required) {
        continue
      }
      if (!String(values[field.key] ?? '').trim()) {
        return `${company.companyName}은(는) ${field.label}이(가) 필요합니다.`
      }
    }
  }
  return null
}

export function buildClaimDataWithCompanySpecificFields(
  claimData: Record<string, string>,
  companyId: string,
  companySpecificFields: CompanySpecificFields,
): Record<string, string | Record<string, string>> {
  const specific = companySpecificFields[companyId] ?? {}
  const cleaned = Object.fromEntries(
    Object.entries(specific).filter(([, value]) => String(value ?? '').trim() !== ''),
  )
  if (Object.keys(cleaned).length === 0) {
    return { ...claimData }
  }
  return {
    ...claimData,
    companySpecificFields: cleaned,
  }
}

export type MultiClaimGenerateFailure = {
  companyName: string
  message: string
}

export function formatMultiClaimGenerateMessage(successCount: number, failures: MultiClaimGenerateFailure[]): string {
  if (successCount > 0 && failures.length === 0) {
    return `${successCount}건의 청구 문서를 생성했습니다.`
  }
  if (successCount > 0 && failures.length > 0) {
    const failLines = failures.map((row) => `${row.companyName}: ${row.message}`).join('\n')
    return `${successCount + failures.length}건 중 ${successCount}건 생성 완료, ${failures.length}건 실패\n${failLines}`
  }
  if (failures.length > 0) {
    const failLines = failures.map((row) => `${row.companyName}: ${row.message}`).join('\n')
    return `청구 문서 생성에 실패했습니다.\n${failLines}`
  }
  return '청구 문서 생성에 실패했습니다.'
}

export function getExtraFieldsForSelectedCompany(company: SelectedClaimCompany): ClaimCompanyExtraFieldDef[] {
  return getExtraFieldsForCompany(company)
}
