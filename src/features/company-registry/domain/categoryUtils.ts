import { INSURANCE_TYPE_LABELS, INSURANCE_TYPE_ORDER, type InsuranceCategory } from './insuranceConstants'

export function normalizeInsuranceCategory(raw: string | undefined | null): InsuranceCategory | '' {
  const s = String(raw ?? '').trim()
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
  return ''
}

export function insuranceCategoryLabel(cat: string): string {
  const n = normalizeInsuranceCategory(cat)
  if (n && n in INSURANCE_TYPE_LABELS) {
    return INSURANCE_TYPE_LABELS[n]
  }
  return cat || '—'
}

export function insuranceTypeSortRank(cat: string): number {
  const n = normalizeInsuranceCategory(cat)
  const idx = INSURANCE_TYPE_ORDER.indexOf(n as InsuranceCategory)
  return idx === -1 ? 99 : idx
}
