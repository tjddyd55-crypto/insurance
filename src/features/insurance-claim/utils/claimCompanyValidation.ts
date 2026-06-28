export function validateCompanySelection(selectedCompanyId: string | null): string | null {
  if (!selectedCompanyId) {
    return '보험회사를 선택해 주세요.'
  }
  return null
}

export function resolveDefaultClaimFaxNumber(company: {
  faxNumber?: string | null
  claimFaxNumber?: string | null
}): string {
  const claimFax = String(company.claimFaxNumber ?? '').trim()
  if (claimFax) {
    return claimFax
  }
  return String(company.faxNumber ?? '').trim()
}
