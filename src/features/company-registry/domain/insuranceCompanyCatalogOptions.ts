import type { InsurerSite, InsurerSiteCategory } from '../../insurer-sites/api/insurerSitesApi'
import { canonicalInsuranceCategoryForFilter } from './categoryUtils'
import type { InsuranceCategory } from './insuranceConstants'
import { buildStaticCompanyCode, isPersistedDirectoryCompanyCode } from './companyCode'
import type { ContactCompanyCardDraft } from './contactCardWorkspaceModel'
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

export type CatalogSiteDirectoryBinding = {
  companyCode: string
  companyName: string
  companyId: number | null
  customerCenter: string
  ambiguousDirectoryMatches: number
}

/** 카탈로그 보험사명과 디렉터리 마스터를 1:1로만 연결한다. 동일 이름 중복 마스터는 STATIC으로 신규 저장한다. */
export function resolveCatalogSiteDirectoryBinding(
  directory: CompanyDirectoryEntry[],
  category: InsuranceCategory,
  siteName: string,
): CatalogSiteDirectoryBinding {
  const staticCode = buildStaticCompanyCode(category, siteName)
  const filterKey = canonicalInsuranceCategoryForFilter(category)
  const nameKey = normalizeCompanyName(siteName)
  const matches =
    filterKey == null
      ? []
      : directory.filter(
          (entry) =>
            canonicalInsuranceCategoryForFilter(entry.category, entry.name ?? '') === filterKey &&
            normalizeCompanyName(entry.name) === nameKey,
        )

  if (matches.length === 1) {
    const entry = matches[0]
    return {
      companyCode: entry.companyCode,
      companyName: entry.name,
      companyId: entry.id > 0 ? entry.id : null,
      customerCenter: entry.customerCenter?.trim() || '',
      ambiguousDirectoryMatches: 0,
    }
  }

  return {
    companyCode: staticCode,
    companyName: siteName,
    companyId: null,
    customerCenter: '',
    ambiguousDirectoryMatches: matches.length,
  }
}

/**
 * 신규 카드 보험회사 선택 SSOT: 전역 설계사이트 카탈로그(`/api/insurer-sites`).
 * GA 디렉터리는 **이름·종류가 정확히 일치하는 단일 마스터**만 companyCode에 반영한다.
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
  const seenCatalogNames = new Set<string>()

  const activeSites = insurerCatalog
    .filter((row) => row.isActive && row.category === siteCategory)
    .sort((a, b) => {
      const order = a.sortOrder - b.sortOrder
      if (order !== 0) return order
      return a.name.localeCompare(b.name, 'ko')
    })

  for (const site of activeSites) {
    const binding = resolveCatalogSiteDirectoryBinding(directory, category, site.name)
    const nameKey = normalizeCompanyName(binding.companyName)
    if (seenCatalogNames.has(nameKey)) continue
    seenCatalogNames.add(nameKey)
    options.push({
      companyCode: binding.companyCode,
      name: binding.companyName,
      tel: binding.customerCenter,
    })
  }

  const filterKey = canonicalInsuranceCategoryForFilter(category)
  if (filterKey) {
    for (const entry of directory) {
      if (canonicalInsuranceCategoryForFilter(entry.category, entry.name ?? '') !== filterKey) {
        continue
      }
      const nameKey = normalizeCompanyName(entry.name)
      if (seenCatalogNames.has(nameKey)) continue
      seenCatalogNames.add(nameKey)
      options.push({
        companyCode: entry.companyCode,
        name: entry.name,
        tel: entry.customerCenter?.trim() || '',
      })
    }
  }

  return options.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export function applyPickerCompanySelection(
  draft: ContactCompanyCardDraft,
  companyCode: string,
  options: InsuranceCompanyOption[],
  directory: CompanyDirectoryEntry[],
): ContactCompanyCardDraft {
  const code = companyCode.trim()
  const option = options.find((row) => row.companyCode === code)
  if (!option) {
    return { ...draft, companyCode: code, companyName: '', companyId: null }
  }

  const binding = resolveCatalogSiteDirectoryBinding(directory, draft.category, option.name)
  let companyId: number | null = null
  if (binding.companyId != null && isPersistedDirectoryCompanyCode(binding.companyCode)) {
    companyId = binding.companyId
  }

  return {
    ...draft,
    companyCode: binding.companyCode,
    companyName: binding.companyName,
    customerCenter: binding.customerCenter || option.tel || '',
    companyId,
  }
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
