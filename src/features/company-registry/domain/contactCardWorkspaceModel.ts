import type { InsuranceContact, InsuranceContactCategory } from '../../contacts/domain/types'
import { canonicalInsuranceCategoryForFilter, resolveTabCategory } from './categoryUtils'
import { buildStaticCompanyCode } from './loadCompanyData'
import type { InsuranceCategory } from './insuranceConstants'
import { isInsuranceCategory } from './insuranceConstants'
import type { CompanyDirectoryEntry, InsuranceCompanyOption } from './types'

export type ContactPersonDraft = {
  rowKey: string
  name: string
  position: string
  phone: string
  personalContactId?: string
}

export type ContactCompanyCardDraft = {
  cardKey: string
  category: InsuranceCategory
  companyCode: string
  companyId: number | null
  companyName: string
  customerCenter: string
  systemPhone: string
  incallNumber: string
  visitInfo: string
  contacts: ContactPersonDraft[]
  isNew: boolean
  markedForDeletion: boolean
}

function newRowKey(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function newCardKey(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyContactRow(): ContactPersonDraft {
  return { rowKey: newRowKey(), name: '', position: '', phone: '' }
}

export function directoryEntryToCardDraft(entry: CompanyDirectoryEntry, category: InsuranceCategory): ContactCompanyCardDraft {
  const contacts =
    entry.contacts?.length
      ? entry.contacts.map((person) => ({
          rowKey: newRowKey(),
          name: person.name ?? '',
          position: person.position ?? '',
          phone: person.phone ?? '',
        }))
      : [emptyContactRow()]
  return {
    cardKey: `dir-${entry.companyCode}-${entry.id}`,
    category,
    companyCode: entry.companyCode,
    companyId: entry.id > 0 ? entry.id : null,
    companyName: entry.name,
    customerCenter: entry.customerCenter ?? '',
    systemPhone: entry.systemPhone ?? '',
    incallNumber: entry.incallNumber ?? '',
    visitInfo: entry.visitInfo ?? '',
    contacts,
    isNew: false,
    markedForDeletion: false,
  }
}

export function personalContactsToCardDrafts(
  contacts: InsuranceContact[],
  activeTab: InsuranceCategory,
): ContactCompanyCardDraft[] {
  const byCompany = new Map<string, InsuranceContact[]>()
  for (const row of contacts) {
    if (row.category !== activeTab) continue
    const key = `${row.category}\0${row.companyName.trim().normalize('NFKC')}`
    const bucket = byCompany.get(key) ?? []
    bucket.push(row)
    byCompany.set(key, bucket)
  }
  const drafts: ContactCompanyCardDraft[] = []
  for (const rows of byCompany.values()) {
    const first = rows[0]
    const category = first.category as InsuranceCategory
    if (!isInsuranceCategory(category)) continue
    drafts.push({
      cardKey: `personal-${category}-${first.companyName}`,
      category,
      companyCode: buildStaticCompanyCode(category, first.companyName),
      companyId: null,
      companyName: first.companyName,
      customerCenter: '',
      systemPhone: '',
      incallNumber: '',
      visitInfo: '',
      contacts: rows.map((row) => ({
        rowKey: newRowKey(),
        name: row.managerName,
        position: row.position,
        phone: row.phoneNumber,
        personalContactId: row.id,
      })),
      isNew: false,
      markedForDeletion: false,
    })
  }
  return drafts.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko'))
}

export function buildCompanyOptions(
  directory: CompanyDirectoryEntry[],
  category: InsuranceCategory,
): InsuranceCompanyOption[] {
  const filterKey = canonicalInsuranceCategoryForFilter(category)
  if (!filterKey) return []
  return directory
    .filter((entry) => canonicalInsuranceCategoryForFilter(entry.category, entry.name ?? '') === filterKey)
    .map((entry) => ({
      companyCode: entry.companyCode,
      name: entry.name,
      tel: entry.customerCenter || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export function resolveCardCategory(entry: CompanyDirectoryEntry, fallbackTab: InsuranceCategory): InsuranceCategory {
  const tab = resolveTabCategory(entry.category, entry.name)
  if (tab && isInsuranceCategory(tab)) return tab
  return fallbackTab
}

export function cardDraftMatchesSearch(draft: ContactCompanyCardDraft, keyword: string): boolean {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  if (draft.companyName.toLowerCase().includes(q)) return true
  return draft.contacts.some(
    (person) =>
      person.name.toLowerCase().includes(q) ||
      person.position.toLowerCase().includes(q) ||
      person.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
  )
}

export function findDuplicateCard(
  drafts: ContactCompanyCardDraft[],
  category: InsuranceCategory,
  companyCode: string,
  excludeCardKey?: string,
): ContactCompanyCardDraft | undefined {
  const code = companyCode.trim()
  return drafts.find(
    (draft) =>
      draft.cardKey !== excludeCardKey &&
      !draft.markedForDeletion &&
      draft.category === category &&
      draft.companyCode === code,
  )
}

export function categoryFromInsuranceContactCategory(category: InsuranceContactCategory): InsuranceCategory {
  return category
}
