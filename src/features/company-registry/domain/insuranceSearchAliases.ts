/** 원수사 연락처 검색용 보조 키워드(표시명은 DB name 유지). */
export const INSURANCE_COMPANY_SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  처브생명: ['Chubb Life', 'chubb'],
}

export function companyDirectoryRowMatchesSearchAlias(companyName: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) {
    return false
  }
  const aliases = INSURANCE_COMPANY_SEARCH_ALIASES[String(companyName ?? '').trim()] ?? []
  return aliases.some((alias) => alias.toLowerCase().includes(q))
}
