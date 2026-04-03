import {
  canonicalInsuranceCategoryForFilter,
  normalizeInsuranceCategory,
  resolveTabCategory,
} from './categoryUtils'
import type { InsuranceCategory } from './insuranceConstants'
import type {
  CompanyDirectoryEntry,
  InsuranceCompanyContactDraft,
  InsuranceCompanyFormState,
} from './types'

const EMPTY_COMPANY_FIELDS: Omit<InsuranceCompanyFormState, 'id' | 'category' | 'name'> = {
  customerCenter: '',
  systemPhone: '',
  incallNumber: '',
  visitInfo: '',
}

export const EMPTY_CONTACT: InsuranceCompanyContactDraft = { name: '', position: '', phone: '' }

function entryToFormState(entry: CompanyDirectoryEntry): InsuranceCompanyFormState {
  const resolved =
    resolveTabCategory(entry.category, entry.name) ||
    normalizeInsuranceCategory(entry.category) ||
    entry.category
  return {
    id: entry.id,
    category: resolved,
    name: entry.name,
    customerCenter: entry.customerCenter,
    systemPhone: entry.systemPhone,
    incallNumber: entry.incallNumber,
    visitInfo: entry.visitInfo,
  }
}

function entryContactsToDrafts(entry: CompanyDirectoryEntry): InsuranceCompanyContactDraft[] {
  if (!entry.contacts?.length) {
    return [{ ...EMPTY_CONTACT }]
  }
  return entry.contacts.map((c) => ({
    name: c.name ?? '',
    position: c.position ?? '',
    phone: c.phone ?? '',
  }))
}

/** DB 레코드 한 건을 폼 상태·담당자 초안으로 변환 (목록 클릭·자동 매칭 공통) */
export function formStateFromDirectoryEntry(entry: CompanyDirectoryEntry): {
  company: InsuranceCompanyFormState
  contacts: InsuranceCompanyContactDraft[]
} {
  return {
    company: entryToFormState(entry),
    contacts: entryContactsToDrafts(entry),
  }
}

/** 목록 로드 지연·공백·DB category만 있는 경우까지 동일 보험사 매칭 */
export function findSavedEntryForSelection(
  rows: CompanyDirectoryEntry[],
  selectedType: InsuranceCategory,
  companyName: string,
): CompanyDirectoryEntry | undefined {
  const q = companyName.trim().normalize('NFKC')
  if (!q) {
    return undefined
  }
  const want = canonicalInsuranceCategoryForFilter(selectedType)
  if (!want) {
    return undefined
  }
  const resolved = rows.find((e) => {
    const rowCat = resolveTabCategory(e.category, e.name)
    const rowWant = canonicalInsuranceCategoryForFilter(rowCat)
    return rowWant === want && e.name.trim().normalize('NFKC') === q
  })
  if (resolved) {
    return resolved
  }
  return rows.find(
    (e) =>
      e.name.trim().normalize('NFKC') === q &&
      (canonicalInsuranceCategoryForFilter(normalizeInsuranceCategory(e.category) || e.category) ===
        want ||
        canonicalInsuranceCategoryForFilter(
          String(e.category ?? '')
            .trim()
            .toUpperCase()
            .replace(/-/g, '_'),
        ) === want),
  )
}

export type LoadCompanyDataResult =
  | {
      syncForm: true
      company: InsuranceCompanyFormState
      contacts: InsuranceCompanyContactDraft[]
      prevSelection: { type: string; company: string }
    }
  | {
      syncForm: false
      prevSelection: { type: string; company: string }
    }

/**
 * 보험 종류·보험사 선택과 서버 목록을 기준으로 폼에 반영할 데이터를 계산합니다.
 * - 저장된 동일 보험사가 있으면 DB 그대로
 * - 없고 선택이 바뀌었면 빈 행(자동 채움 없음)
 * - 선택이 같고 DB에 없으면 폼은 그대로(prevSelection만 정합)
 */
export function loadCompanyData(
  list: CompanyDirectoryEntry[],
  selectedType: InsuranceCategory | '',
  selectedCompanyName: string,
  prevSelection: { type: string; company: string },
): LoadCompanyDataResult | null {
  const nameTrim = selectedCompanyName.trim()
  if (!nameTrim) {
    return {
      syncForm: true,
      company: {
        id: null,
        category: selectedType || '',
        name: '',
        ...EMPTY_COMPANY_FIELDS,
      },
      contacts: [{ ...EMPTY_CONTACT }],
      prevSelection: { type: '', company: '' },
    }
  }

  if (!selectedType) {
    return null
  }

  const entry = findSavedEntryForSelection(list, selectedType, selectedCompanyName)
  const nextPrev = { type: selectedType, company: nameTrim }

  if (entry) {
    const { company: loaded, contacts } = formStateFromDirectoryEntry(entry)
    return {
      syncForm: true,
      company: {
        ...loaded,
        name: nameTrim,
        category: selectedType,
      },
      contacts,
      prevSelection: nextPrev,
    }
  }

  const selChanged = prevSelection.type !== selectedType || prevSelection.company !== nameTrim

  if (selChanged) {
    return {
      syncForm: true,
      company: {
        id: null,
        category: selectedType,
        name: nameTrim,
        ...EMPTY_COMPANY_FIELDS,
        customerCenter: '',
      },
      contacts: [{ ...EMPTY_CONTACT }],
      prevSelection: nextPrev,
    }
  }

  return {
    syncForm: false,
    prevSelection: nextPrev,
  }
}
