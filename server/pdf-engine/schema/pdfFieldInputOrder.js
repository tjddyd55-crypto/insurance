/**
 * PDF 템플릿 필드 — 신청서 입력 순서 정렬 (서버/클라이언트 동일 규칙).
 */

/**
 * @param {{ placements?: Array<{ page: number, x: number, y: number }> }} field
 * @returns {[number, number, number]}
 */
function placementFallbackTuple(field) {
  const placements = Array.isArray(field.placements) ? field.placements : []
  const sorted = [...placements].sort((a, b) => {
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

/**
 * @param {import('./fieldSpec.js').FieldSpec} a
 * @param {import('./fieldSpec.js').FieldSpec} b
 * @returns {number}
 */
export function comparePdfFieldsByInputOrder(a, b) {
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
  return String(a.fieldKey).localeCompare(String(b.fieldKey))
}

/**
 * @template T
 * @param {T[]} fields
 * @returns {T[]}
 */
export function sortPdfFieldsByInputOrder(fields) {
  return [...fields].sort(comparePdfFieldsByInputOrder)
}
