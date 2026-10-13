import type { InsurerSite, InsurerSiteCategory } from '../../insurer-sites/api/insurerSitesApi'
import { canonicalInsuranceCategoryForFilter } from './categoryUtils'
import type { InsuranceCategory } from './insuranceConstants'
import { buildStaticCompanyCode, findSavedEntryForSelection } from './loadCompanyData'
import type { CompanyDirectoryEntry, InsuranceCompanyOption } from './types'
import { buildCompanyOptions } from './contactCardWorkspaceModel'

function normalizeCompanyName(value: string): string {
  return String(value ?? '').trim().normalize('NFKC')
}

function insurerSiteCategoryToInsurance(category: InsurerSiteCategory): InsuranceCategory {
  return category === 'life' ? 'LIFE' : 'NON_LIFE'
}

function insuranceCategoryToInsurerSite(category: InsuranceCategory): InsurerSiteCategory | null {
  if (category === 'LIFE') return 'life'
  if (category === 'NON_LIFE') return 'non_life'
  return null
}

/**
 * 신규 카드 보험회사 선택 SSOT: 전역 설계사이트 카탈로그(`/api/insurer-sites`).
 * GA 디렉터리에 이미 있는 회사는 동일 companyCode·고객센터로 매칭한다.
 * GENERAL은 설계사이트에 없으므로 GA 디렉터리 목록만 사용한다.
 */
export function buildInsuranceCompanyPickerOptions(
  directory: CompanyDirectoryEntry[],
  insurerCatalog: InsurerSite[],
  category: InsuranceCategory,
): InsuranceCompanyOption[] {
  const siteCategory = insuranceCategoryToInsurerSite(category)
  if (!siteCategory) {
    return buildCompanyOptions(directory, category)
  }

  const options: InsuranceCompanyOption[] = []
  const seenNames = new Set<string>()

  const activeSites = insurerCatalog
    .filter((row) => row.isActive && row.category === siteCategory)
    .sort((a, b) => {
      const order = a.sortOrder - b.sortOrder
      if (order !== 0) return order
      return a.name.localeCompare(b.name, 'ko')
    })

  for (const site of activeSites) {
    const staticCode = buildStaticCompanyCode(category, site.name)
    const entry = findSavedEntryForSelection(directory, category, staticCode)
    const nameKey = normalizeCompanyName(entry?.name ?? site.name)
    if (seenNames.has(nameKey)) continue
    seenNames.add(nameKey)
    options.push({
      companyCode: entry?.companyCode ?? staticCode,
      name: entry?.name ?? site.name,
      tel: entry?.customerCenter?.trim() || '',
    })
  }

  const filterKey = canonicalInsuranceCategoryForFilter(category)
  if (filterKey) {
    for (const entry of directory) {
      if (canonicalInsuranceCategoryForFilter(entry.category, entry.name ?? '') !== filterKey) {
        continue
      }
      const nameKey = normalizeCompanyName(entry.name)
      if (seenNames.has(nameKey)) continue
      seenNames.add(nameKey)
      options.push({
        companyCode: entry.companyCode,
        name: entry.name,
        tel: entry.customerCenter?.trim() || '',
      })
    }
  }

  return options.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export function filterInsurerCatalogForCategory(
  insurerCatalog: InsurerSite[],
  category: InsuranceCategory,
): InsurerSite[] {
  const siteCategory = insuranceCategoryToInsurerSite(category)
  if (!siteCategory) return []
  return insurerCatalog.filter((row) => row.isActive && row.category === siteCategory)
}

export { insurerSiteCategoryToInsurance }
