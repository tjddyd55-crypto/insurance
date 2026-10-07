/**
 * Prioritize which unstructured blocks receive limited GPT semantic budget.
 * @param {import('./semanticFieldExtract.js').UnstructuredSemanticRecord} semantic
 * @param {string} sourceText
 */
export function scoreSemanticGptPriority(semantic, sourceText) {
  let score = 0
  if (semantic.personName) {
    score += 30
  }
  if (semantic.phones.length > 0) {
    score += 25
  }
  if (semantic.address) {
    score += 15
  }
  if (semantic.job || semantic.company) {
    score += 8
  }
  if (semantic.carNumber) {
    score += 4
  }
  const unresolved = semantic.unresolvedLines.length
  score += Math.max(0, 24 - unresolved * 5)
  if (semantic.residentRegistrationNumber) {
    score += 3
  }
  const len = String(sourceText ?? '').length
  if (len > 2500) {
    score -= 12
  } else if (len > 1200) {
    score -= 5
  }
  if (!semantic.personName && semantic.phones.length === 0) {
    score -= 20
  }
  return score
}
