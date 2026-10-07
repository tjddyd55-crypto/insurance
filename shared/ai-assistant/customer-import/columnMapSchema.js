import { CUSTOMER_IMPORT_FIELD_KEYS } from './fieldDictionary.js'

export const COLUMN_MAP_JSON_SCHEMA = {
  name: 'onefc_customer_import_column_map',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['mappings', 'ignoredColumns', 'warnings'],
    properties: {
      mappings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sourceColumn', 'destinationField', 'confidence', 'reason'],
          properties: {
            sourceColumn: { type: 'string', minLength: 1 },
            destinationField: { type: 'string', enum: [...CUSTOMER_IMPORT_FIELD_KEYS] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reason: { type: 'string', maxLength: 500 },
          },
        },
      },
      ignoredColumns: {
        type: 'array',
        items: { type: 'string' },
      },
      warnings: {
        type: 'array',
        items: { type: 'string', maxLength: 500 },
      },
    },
  },
}

const AUTO_APPLY_CONFIDENCE = 0.9
const SUGGEST_CONFIDENCE = 0.7

/**
 * @param {object} raw
 * @param {string[]} allowedHeaders
 */
export function validateColumnMapResponse(raw, allowedHeaders) {
  if (!raw || typeof raw !== 'object') {
    throw Object.assign(new Error('OPENAI_INVALID_OUTPUT'), { code: 'OPENAI_INVALID_OUTPUT' })
  }
  const headerSet = new Set(allowedHeaders.map((h) => String(h).trim()).filter(Boolean))
  const mappings = Array.isArray(raw.mappings) ? raw.mappings : []
  const usedDestinations = new Set()
  const normalized = []

  for (const item of mappings) {
    const sourceColumn = String(item?.sourceColumn ?? '').trim()
    const destinationField = String(item?.destinationField ?? '').trim()
    const confidence = Number(item?.confidence)
    if (!headerSet.has(sourceColumn)) {
      continue
    }
    if (!CUSTOMER_IMPORT_FIELD_KEYS.includes(destinationField)) {
      continue
    }
    if (usedDestinations.has(destinationField)) {
      continue
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      continue
    }
    usedDestinations.add(destinationField)
    normalized.push({
      sourceColumn,
      destinationField,
      confidence,
      reason: String(item?.reason ?? '').slice(0, 500),
      autoApply: confidence >= AUTO_APPLY_CONFIDENCE,
      needsReview: confidence >= SUGGEST_CONFIDENCE && confidence < AUTO_APPLY_CONFIDENCE,
      blocked: confidence < SUGGEST_CONFIDENCE,
    })
  }

  const ignoredColumns = (Array.isArray(raw.ignoredColumns) ? raw.ignoredColumns : [])
    .map((c) => String(c).trim())
    .filter((c) => headerSet.has(c))

  const warnings = (Array.isArray(raw.warnings) ? raw.warnings : [])
    .map((w) => String(w).trim())
    .filter(Boolean)
    .slice(0, 20)

  return { mappings: normalized, ignoredColumns, warnings }
}
