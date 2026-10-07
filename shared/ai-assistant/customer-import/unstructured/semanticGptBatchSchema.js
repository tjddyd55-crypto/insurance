import { SEMANTIC_FIELD_KEYS } from './semanticVocabulary.js'

const assignmentItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    field: { type: 'string', enum: [...SEMANTIC_FIELD_KEYS] },
    tokenOrText: { type: 'string' },
    confidence: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['field', 'tokenOrText', 'confidence', 'reason'],
}

export const SEMANTIC_GPT_BATCH_JSON_SCHEMA = {
  name: 'customer_semantic_batch',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            recordId: { type: 'string' },
            assignments: { type: 'array', items: assignmentItemSchema },
            unresolvedFragments: { type: 'array', items: { type: 'string' } },
            multiPersonHint: { type: 'boolean' },
            warnings: { type: 'array', items: { type: 'string' } },
          },
          required: ['recordId', 'assignments', 'unresolvedFragments', 'multiPersonHint', 'warnings'],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['items', 'warnings'],
  },
}
