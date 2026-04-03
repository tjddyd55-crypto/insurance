import {
  insuranceCompanyMap,
  INSURANCE_TYPE_LABELS,
  INSURANCE_TYPE_ORDER,
  type InsuranceCategory,
} from './insuranceConstants'

export function normalizeInsuranceCategory(raw: string | undefined | null): InsuranceCategory | '' {
  const s = String(raw ?? '')
    .trim()
    .normalize('NFKC')
  if (!s) {
    return ''
  }
  const u = s.toUpperCase().replace(/-/g, '_')
  if (u === 'NONLIFE') {
    return 'NON_LIFE'
  }
  if (u === 'LIFE' || u === 'NON_LIFE' || u === 'GENERAL') {
    return u
  }
  const lower = s.toLowerCase()
  if (lower === 'life') {
    return 'LIFE'
  }
  if (lower === 'nonlife') {
    return 'NON_LIFE'
  }

  const ko = s.replace(/\s+/g, '')
  if (/^(생명|생명보험|생보)$/.test(ko) || ko === '생명보험') {
    return 'LIFE'
  }
  if (
    /^(손해|손해보험|손보|재산|화재)$/.test(ko) ||
    ko === '손해보험' ||
    ko === '손해보험사'
  ) {
    return 'NON_LIFE'
  }
  if (/^(일반|일반보험)$/.test(ko) || ko === '일반보험') {
    return 'GENERAL'
  }
  return ''
}

/**
 * DB category가 비어 있어도 insuranceCompanyMap(2차 드롭다운)에 이름이 있으면 구분 추론.
 */
export function inferInsuranceCategoryFromKnownCompanies(companyName: string): InsuranceCategory | '' {
  const q = String(companyName ?? '').trim()
  if (!q) {
    return ''
  }
  for (const cat of INSURANCE_TYPE_ORDER) {
    const options = insuranceCompanyMap[cat] ?? []
    if (options.some((o) => o.name === q)) {
      return cat
    }
  }
  return ''
}

/** 연락처 조회 탭 매칭: 정규화 → 맵 매칭. 여전히 없으면 '' (호출부에서 생명 탭 폴백 가능). */
export function resolveTabCategory(
  rawCategory: string | undefined | null,
  companyName: string | undefined | null,
): InsuranceCategory | '' {
  const name = String(companyName ?? '')
    .trim()
    .normalize('NFKC')
  return (
    normalizeInsuranceCategory(rawCategory) || inferInsuranceCategoryFromKnownCompanies(name)
  )
}

/**
 * 1차(생명/손해/일반) 선택값과 목록 행이 같은 보험 구분인지 — 정규화 후 비교.
 * selected는 드롭다운 값(LIFE | NON_LIFE | GENERAL) 또는 일부 레거시 한글 라벨.
 */
export function canonicalInsuranceCategoryForFilter(
  selected: string | undefined | null,
): InsuranceCategory | '' {
  const s = String(selected ?? '')
    .trim()
    .normalize('NFKC')
  if (!s) {
    return ''
  }
  const fromNorm = normalizeInsuranceCategory(s)
  if (fromNorm) {
    return fromNorm
  }
  if ((INSURANCE_TYPE_ORDER as readonly string[]).includes(s)) {
    return s as InsuranceCategory
  }
  return ''
}

export function insuranceCategoryLabel(cat: string | undefined | null): string {
  const raw = typeof cat === 'string' ? cat : String(cat ?? '')
  const n = normalizeInsuranceCategory(raw)
  if (n && n in INSURANCE_TYPE_LABELS) {
    return INSURANCE_TYPE_LABELS[n]
  }
  return raw || '—'
}

export function insuranceTypeSortRank(cat: string): number {
  const n = normalizeInsuranceCategory(cat)
  const idx = INSURANCE_TYPE_ORDER.indexOf(n as InsuranceCategory)
  return idx === -1 ? 99 : idx
}
