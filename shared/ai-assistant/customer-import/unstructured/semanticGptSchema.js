import { SEMANTIC_FIELD_KEYS } from './semanticVocabulary.js'

export const SEMANTIC_GPT_JSON_SCHEMA = {
  name: 'customer_semantic_block',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            field: { type: 'string', enum: [...SEMANTIC_FIELD_KEYS] },
            tokenOrText: { type: 'string' },
            confidence: { type: 'number' },
            reason: { type: 'string' },
          },
          required: ['field', 'tokenOrText', 'confidence', 'reason'],
        },
      },
      unresolvedFragments: {
        type: 'array',
        items: { type: 'string' },
      },
      multiPersonHint: { type: 'boolean' },
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['assignments', 'unresolvedFragments', 'multiPersonHint', 'warnings'],
  },
}

/**
 * @param {unknown} payload
 */
export function validateSemanticGptResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('SEMANTIC_GPT_INVALID_SHAPE')
  }
  const assignments = Array.isArray(payload.assignments) ? payload.assignments : []
  const normalized = []
  for (const item of assignments) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const field = String(item.field ?? '')
    if (!SEMANTIC_FIELD_KEYS.includes(field)) {
      continue
    }
    const confidence = Number(item.confidence)
    normalized.push({
      field,
      tokenOrText: String(item.tokenOrText ?? '').trim(),
      confidence: Number.isFinite(confidence) ? confidence : 0,
      reason: String(item.reason ?? '').slice(0, 240),
    })
  }
  return {
    assignments: normalized,
    unresolvedFragments: Array.isArray(payload.unresolvedFragments)
      ? payload.unresolvedFragments.map((s) => String(s).slice(0, 500))
      : [],
    multiPersonHint: Boolean(payload.multiPersonHint),
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((s) => String(s).slice(0, 240)) : [],
  }
}
