import type { PdfFieldSpec } from '../types'

function placementFallbackTuple(field: PdfFieldSpec): [number, number, number] {
  const sorted = [...(field.placements ?? [])].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })
  const p = sorted[0]
  if (!p) {
    return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
  }
  return [p.page, p.y, p.x]
}

/** 신청서 입력 순서 정렬 — inputOrder 없으면 orderIndex → placement → fieldKey */
export function comparePdfFieldsByInputOrder(a: PdfFieldSpec, b: PdfFieldSpec): number {
  const ai = a.inputOrder
  const bi = b.inputOrder
  if (ai != null && bi != null && ai !== bi) return ai - bi
  if (ai != null && bi == null) return -1
  if (ai == null && bi != null) return 1
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
  const [ap, ay, ax] = placementFallbackTuple(a)
  const [bp, by, bx] = placementFallbackTuple(b)
  if (ap !== bp) return ap - bp
  if (ay !== by) return ay - by
  if (ax !== bx) return ax - bx
  return a.fieldKey.localeCompare(b.fieldKey)
}

export function sortPdfFieldsByInputOrder<T extends PdfFieldSpec>(fields: T[]): T[] {
  return [...fields].sort(comparePdfFieldsByInputOrder)
}

/** inputOrder 가 비어 있으면 현재 fallback 순서로 0..n-1 부여 */
export function assignSequentialInputOrders<T extends PdfFieldSpec>(fields: T[]): T[] {
  const sorted = sortPdfFieldsByInputOrder(fields)
  return sorted.map((f, i) => ({ ...f, inputOrder: i }))
}

export function displayInputOrderRank(fields: PdfFieldSpec[], fieldKey: string): number {
  const sorted = sortPdfFieldsByInputOrder(fields)
  const idx = sorted.findIndex((f) => f.fieldKey === fieldKey)
  return idx < 0 ? 0 : idx + 1
}

export function moveFieldInputOrder(
  fields: PdfFieldSpec[],
  fieldKey: string,
  direction: -1 | 1,
): PdfFieldSpec[] {
  const withOrders =
    fields.some((f) => f.inputOrder == null) ? assignSequentialInputOrders(fields) : fields
  const sorted = sortPdfFieldsByInputOrder(withOrders)
  const idx = sorted.findIndex((f) => f.fieldKey === fieldKey)
  if (idx < 0) return fields
  const target = idx + direction
  if (target < 0 || target >= sorted.length) return withOrders
  const orderByKey = new Map(sorted.map((f) => [f.fieldKey, f.inputOrder ?? 0]))
  const currentOrder = orderByKey.get(fieldKey) ?? idx
  const swapKey = sorted[target].fieldKey
  const swapOrder = orderByKey.get(swapKey) ?? target
  return withOrders.map((f) => {
    if (f.fieldKey === fieldKey) return { ...f, inputOrder: swapOrder }
    if (f.fieldKey === swapKey) return { ...f, inputOrder: currentOrder }
    return f
  })
}
