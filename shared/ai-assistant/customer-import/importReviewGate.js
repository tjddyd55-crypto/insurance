const EXACT_REVIEW_REASONS = new Set([
  'REVIEW_REQUIRED',
  'SEMANTIC_REVIEW',
  'UNRESOLVED_SEMANTIC_FRAGMENTS',
  'MISSING_PHONE',
  'MISSING_NAME',
  'SEMANTIC_GPT_CALL_CAP',
])

const REVIEW_REASON_PREFIXES = ['OPENAI_', 'SEMANTIC_GPT_', 'GPT_']

/**
 * @param {string[]} reasons
 */
export function reasonRequiresImportReview(reasons) {
  const list = Array.isArray(reasons) ? reasons : []
  for (const reason of list) {
    const r = String(reason ?? '')
    if (EXACT_REVIEW_REASONS.has(r)) {
      return true
    }
    if (REVIEW_REASON_PREFIXES.some((prefix) => r.startsWith(prefix))) {
      return true
    }
  }
  return false
}

/**
 * @param {{ reasons?: string[], unstructuredMeta?: { classification?: string } }} row
 */
export function unstructuredRowRequiresReview(row) {
  if (row?.unstructuredMeta?.classification === 'REVIEW_REQUIRED') {
    return true
  }
  return reasonRequiresImportReview(row?.reasons ?? [])
}
