import type { InsuranceContact, InsuranceContactCategory } from '../domain/types'
import type { CompanyDirectoryEntry } from '../../company-registry/domain/types'
import { canonicalInsuranceCategoryForFilter, resolveTabCategory } from '../../company-registry/domain/categoryUtils'
import { buildStaticCompanyCode } from '../../company-registry/domain/loadCompanyData'
import type { InsuranceCategory } from '../../company-registry/domain/insuranceConstants'

function normalizeCompanyName(value: string): string {
  return String(value ?? '').trim().normalize('NFKC')
}

export function personalContactCompanyGroupKey(contact: InsuranceContact): string {
  return `${contact.category}\0${normalizeCompanyName(contact.companyName)}`
}

/** 동일 보험 종류·보험회사명의 개인 담당자 레코드를 한 묶음으로 만든다. */
export function groupPersonalContactsByCompany(
  contacts: InsuranceContact[],
  tab: InsuranceCategory,
): InsuranceContact[][] {
  const groups = new Map<string, InsuranceContact[]>()
  for (const contact of contacts) {
    if (!contactCategoryMatchesTab(contact, tab)) {
      continue
    }
    const key = personalContactCompanyGroupKey(contact)
    const bucket = groups.get(key) ?? []
    bucket.push(contact)
    groups.set(key, bucket)
  }
  return Array.from(groups.values())
}

function contactCategoryMatchesTab(
  contact: InsuranceContact,
  tab: InsuranceCategory,
): boolean {
  const filterKey = canonicalInsuranceCategoryForFilter(tab)
  if (!filterKey) return false
  return contact.category === filterKey
}

function directoryEntryMatchesContact(
  entry: CompanyDirectoryEntry,
  contact: InsuranceContact,
  tab: InsuranceCategory,
): boolean {
  if (!contactCategoryMatchesTab(contact, tab)) {
    return false
  }
  const entryTab = resolveTabCategory(entry.category, entry.name)
  const filterKey = canonicalInsuranceCategoryForFilter(tab)
  if (entryTab && filterKey && entryTab !== filterKey) {
    return false
  }
  return normalizeCompanyName(entry.name) === normalizeCompanyName(contact.companyName)
}

/**
 * GA 디렉터리 카드 UI에 개인 연락처만 주입한다. GA 디렉터리 담당자 목록은 제거한다.
 */
export function buildPersonalContactsDirectoryView(
  directory: CompanyDirectoryEntry[],
  personalContacts: InsuranceContact[],
  activeTab: InsuranceCategory,
): CompanyDirectoryEntry[] {
  const matchedContactIds = new Set<string>()

  const merged = directory.map((entry) => {
    const mine = personalContacts.filter((contact) => {
      if (!directoryEntryMatchesContact(entry, contact, activeTab)) {
        return false
      }
      matchedContactIds.add(contact.id)
      return true
    })
    return {
      ...entry,
      contacts: mine.map((contact, index) => ({
        id: index + 1,
        companyId: entry.id,
        name: contact.managerName,
        position: contact.position,
        phone: contact.phoneNumber,
      })),
    }
  })

  const unmatched = personalContacts.filter(
    (contact) => contactCategoryMatchesTab(contact, activeTab) && !matchedContactIds.has(contact.id),
  )
  let syntheticId = -1
  for (const rows of groupPersonalContactsByCompany(unmatched, activeTab)) {
    const first = rows[0]
    const category = first.category as InsuranceCategory
    merged.push({
      id: syntheticId,
      companyCode: buildStaticCompanyCode(category, first.companyName),
      category: first.category,
      name: first.companyName,
      customerCenter: '',
      systemPhone: '',
      incallNumber: '',
      visitInfo: '',
      contacts: rows.map((contact, index) => ({
        id: index + 1,
        companyId: 0,
        name: contact.managerName,
        position: contact.position,
        phone: contact.phoneNumber,
      })),
      general: null,
    })
    syntheticId -= 1
  }

  return merged
}

export function filterDirectoryRowsForPersonalView(
  rows: CompanyDirectoryEntry[],
  keyword: string,
): CompanyDirectoryEntry[] {
  const q = keyword.trim().toLowerCase()
  const withContacts = rows.filter((row) => (row.contacts?.length ?? 0) > 0)
  if (!q) {
    return withContacts
  }
  return withContacts.filter((entry) => {
    if (entry.name.toLowerCase().includes(q)) {
      return true
    }
    return (
      entry.contacts?.some(
        (person) =>
          (person.name ?? '').toLowerCase().includes(q) ||
          (person.position ?? '').toLowerCase().includes(q) ||
          (person.phone ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')),
      ) ?? false
    )
  })
}

export function personalContactsForCompany(
  contacts: InsuranceContact[],
  category: InsuranceContactCategory,
  companyName: string,
): InsuranceContact[] {
  const normalized = normalizeCompanyName(companyName)
  return contacts.filter(
    (row) =>
      row.category === category && normalizeCompanyName(row.companyName) === normalized,
  )
}
