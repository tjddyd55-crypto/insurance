import { SEMANTIC_GPT_CONFIDENCE } from './semanticVocabulary.js'

/**
 * @param {import('./semanticFieldExtract.js').UnstructuredSemanticRecord} semantic
 */
export function cloneSemanticRecord(semantic) {
  return {
    ...semantic,
    phones: [...(semantic.phones ?? [])],
    unresolvedLines: [...(semantic.unresolvedLines ?? [])],
  }
}

/**
 * @param {string} tokenOrText
 * @param {Map<string, string>} vault
 */
export function resolveSemanticToken(tokenOrText, vault) {
  const key = String(tokenOrText ?? '').trim()
  if (vault.has(key)) {
    return vault.get(key) ?? ''
  }
  return key
}

/**
 * @param {import('./semanticFieldExtract.js').UnstructuredSemanticRecord} semantic
 * @param {Record<string, boolean>} locks
 * @param {import('./semanticGptSchema.js').validateSemanticGptResponse} gptResult
 * @param {Map<string, string>} vault
 */
export function mergeSemanticWithGpt(semantic, locks, gptResult, vault) {
  const merged = cloneSemanticRecord(semantic)
  const mergeWarnings = []
  let applied = 0
  let reviewHints = 0

  for (const item of gptResult.assignments) {
    const value = resolveSemanticToken(item.tokenOrText, vault)
    if (!value) {
      continue
    }
    const field = item.field
    if (locks[field]) {
      if (conflictsWithLocked(field, merged, value, locks)) {
        mergeWarnings.push(`GPT_CONFLICT_${field}`)
        reviewHints += 1
      }
      continue
    }
    if (item.confidence < SEMANTIC_GPT_CONFIDENCE.REVIEW) {
      reviewHints += 1
      continue
    }
    const appliedOk = applySemanticField(merged, field, value)
    if (!appliedOk) {
      continue
    }
    if (item.confidence >= SEMANTIC_GPT_CONFIDENCE.APPLY) {
      applied += 1
      locks[field] = true
    } else {
      reviewHints += 1
      merged.needsSemanticReview = true
    }
  }

  if (gptResult.multiPersonHint) {
    merged.needsSemanticReview = true
    mergeWarnings.push('GPT_MULTI_PERSON_HINT')
  }

  merged.unresolvedLines = gptResult.unresolvedFragments.filter(Boolean)
  if (reviewHints > 0 || merged.unresolvedLines.length > 0) {
    merged.needsSemanticReview = true
  }
  if (gptResult.warnings.length > 0) {
    merged.needsSemanticReview = true
  }

  return {
    semantic: merged,
    appliedCount: applied,
    warnings: [...mergeWarnings, ...gptResult.warnings],
  }
}

function conflictsWithLocked(field, semantic, gptValue, locks) {
  if (!locks[field]) {
    return false
  }
  const current = readSemanticField(semantic, field)
  if (!current) {
    return false
  }
  return normalizeCompare(current) !== normalizeCompare(gptValue)
}

function normalizeCompare(v) {
  return String(v ?? '').replace(/\s+/g, '').trim().toLowerCase()
}

function readSemanticField(semantic, field) {
  if (field === 'phone') {
    return semantic.phones[0] ?? ''
  }
  return semantic[field] ?? ''
}

function applySemanticField(semantic, field, value) {
  if (field === 'phone') {
    const digits = value.replace(/\D/g, '')
    if (!digits) {
      return false
    }
    if (!semantic.phones.includes(digits)) {
      semantic.phones = [digits, ...semantic.phones.filter((p) => p !== digits)]
    }
    return true
  }
  semantic[field] = value
  return true
}
