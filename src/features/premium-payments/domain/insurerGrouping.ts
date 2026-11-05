import type { CardPaymentContractRow } from '../api/premiumPaymentsApi'

/** 보험사별 보기 그룹 키: 카탈로그 ID / 미지정(빈 값) / 기타(텍스트만, 미매칭) */
export type InsurerGroupKey = `site:${number}` | 'unassigned' | 'other'

export const INSURER_GROUP_UNASSIGNED: InsurerGroupKey = 'unassigned'
export const INSURER_GROUP_OTHER: InsurerGroupKey = 'other'

export function insurerGroupKeyOf(row: Pick<CardPaymentContractRow, 'insuranceCompanyId' | 'insuranceCompany'>): InsurerGroupKey {
  if (row.insuranceCompanyId != null && row.insuranceCompanyId > 0) return `site:${row.insuranceCompanyId}`
  return row.insuranceCompany?.trim() ? INSURER_GROUP_OTHER : INSURER_GROUP_UNASSIGNED
}

export type InsurerGroupOption = {
  key: InsurerGroupKey
  label: string
  category: 'LIFE' | 'NON_LIFE' | null
  count: number
}

/** 데이터에 존재하는 보험사 그룹 (손해→생명, 가나다순) + 기타 + 미지정 (건수 0 이면 생략) */
export function buildInsurerGroupOptions(rows: CardPaymentContractRow[]): InsurerGroupOption[] {
  const map = new Map<InsurerGroupKey, InsurerGroupOption>()
  for (const row of rows) {
    const key = insurerGroupKeyOf(row)
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      continue
    }
    const label =
      key === INSURER_GROUP_OTHER
        ? '기타'
        : key === INSURER_GROUP_UNASSIGNED
          ? '미지정'
          : row.insurerName?.trim() || row.insuranceCompany
    map.set(key, { key, label, category: key.startsWith('site:') ? row.insurerCategory ?? null : null, count: 1 })
  }
  const catOrder = (c: InsurerGroupOption['category']) => (c === 'NON_LIFE' ? 0 : c === 'LIFE' ? 1 : 2)
  const sites = [...map.values()]
    .filter((o) => o.key.startsWith('site:'))
    .sort((a, b) => catOrder(a.category) - catOrder(b.category) || a.label.localeCompare(b.label, 'ko'))
  const tail = [INSURER_GROUP_OTHER, INSURER_GROUP_UNASSIGNED]
    .map((k) => map.get(k))
    .filter((o): o is InsurerGroupOption => Boolean(o))
  return [...sites, ...tail]
}

export type InsurerCustomerGroup = {
  customerId: number
  customerName: string
  customerPhone: string
  contracts: CardPaymentContractRow[]
}

/** 선택 보험사 → 고객(가나다순, 이름 1회) → 계약건. 검색은 선택 보험사 안에서만 필터. */
export function groupContractsByCustomerForInsurer(
  rows: CardPaymentContractRow[],
  key: InsurerGroupKey | null,
  search = '',
): InsurerCustomerGroup[] {
  if (!key) return []
  const q = search.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  const map = new Map<number, InsurerCustomerGroup>()
  for (const row of rows) {
    if (insurerGroupKeyOf(row) !== key) continue
    const name = row.customerName ?? `고객 #${row.customerId}`
    if (q) {
      const phone = (row.customerPhone ?? '').replace(/\D/g, '')
      if (!name.toLowerCase().includes(q) && !(qDigits.length > 0 && phone.includes(qDigits))) continue
    }
    const g = map.get(row.customerId)
    if (g) g.contracts.push(row)
    else map.set(row.customerId, { customerId: row.customerId, customerName: name, customerPhone: row.customerPhone ?? '', contracts: [row] })
  }
  return [...map.values()].sort(
    (a, b) => a.customerName.localeCompare(b.customerName, 'ko') || a.customerId - b.customerId,
  )
}
