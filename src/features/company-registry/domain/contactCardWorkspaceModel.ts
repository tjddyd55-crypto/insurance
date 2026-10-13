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

export function directoryEntryToCardDraft(entry: CompanyDirectoryEntry): ContactCompanyCardDraft {
  const category = resolveCardCategory(entry, 'LIFE')
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

/**
 * 편집 모드 표시: 현재 탭과 일치하거나, 종류 변경 등으로 탭과 어긋난 채 편집 중인 카드(pinned)를 포함한다.
 * cardDrafts 전체는 저장 SSOT이며, 여기서 제외된 카드는 화면에서만 숨긴다.
 */
export function filterVisibleEditDrafts(
  drafts: ContactCompanyCardDraft[],
  activeTab: InsuranceCategory,
  keyword: string,
  pinnedCardKeys: ReadonlySet<string>,
): ContactCompanyCardDraft[] {
  return drafts.filter(
    (draft) =>
      (draft.category === activeTab || pinnedCardKeys.has(draft.cardKey)) &&
      cardDraftMatchesSearch(draft, keyword),
  )
}

/** 탭 전환 시: 새 탭과 종류가 맞는 카드는 pin 해제, 아직 다른 종류로 편집 중인 카드만 pin 유지 */
export function prunePinnedEditCardKeys(
  pinnedCardKeys: ReadonlySet<string>,
  drafts: ContactCompanyCardDraft[],
  activeTab: InsuranceCategory,
): Set<string> {
  const next = new Set<string>()
  for (const cardKey of pinnedCardKeys) {
    const draft = drafts.find((row) => row.cardKey === cardKey)
    if (draft && draft.category !== activeTab) {
      next.add(cardKey)
    }
  }
  return next
}

/** 회사 선택만 초기화하고 담당자 입력은 유지한다. */
export function applyCardCategoryChange(
  draft: ContactCompanyCardDraft,
  category: InsuranceCategory,
  options?: { allowExisting?: boolean },
): ContactCompanyCardDraft {
  if (!draft.isNew && !options?.allowExisting) {
    return draft
  }
  return {
    ...draft,
    category,
    companyCode: '',
    companyName: '',
    customerCenter: '',
    companyId: null,
  }
}

/** @deprecated use applyCardCategoryChange */
export function applyNewCardCategoryChange(
  draft: ContactCompanyCardDraft,
  category: InsuranceCategory,
): ContactCompanyCardDraft {
  return applyCardCategoryChange(draft, category, { allowExisting: false })
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

function normalizeCompanyName(value: string): string {
  return String(value ?? '').trim().normalize('NFKC')
}

export function findDuplicateCard(
  drafts: ContactCompanyCardDraft[],
  category: InsuranceCategory,
  companyCode: string,
  excludeCardKey?: string,
  companyName?: string,
): ContactCompanyCardDraft | undefined {
  const code = companyCode.trim()
  const nameKey = companyName != null ? normalizeCompanyName(companyName) : ''
  return drafts.find((draft) => {
    if (draft.cardKey === excludeCardKey || draft.markedForDeletion || draft.category !== category) {
      return false
    }
    if (code && draft.companyCode.trim() === code) {
      return true
    }
    if (nameKey && normalizeCompanyName(draft.companyName) === nameKey) {
      return true
    }
    return false
  })
}

export function categoryFromInsuranceContactCategory(category: InsuranceContactCategory): InsuranceCategory {
  return category
}
