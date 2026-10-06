/**
 * AI customer list/search query metadata.
 *
 * SSOT rule:
 * - Business meaning and DB storage come from semanticDataCatalog.js.
 * - This file only exposes the customer-query view of that catalog.
 * - No natural-language synonym/keyword table is maintained here.
 */
import { listAiQueryableSemanticFields } from '../semanticDataCatalog.js'

export const CUSTOMER_QUERY_LOGIC = Object.freeze(['AND'])

export const CUSTOMER_QUERY_OPERATORS = Object.freeze([
  'EQ',
  'CONTAINS',
  'IN',
  'BEFORE',
  'AFTER',
  'BETWEEN',
  'PERIOD',
  'IS_NULL',
  'IS_NOT_NULL',
  'INCLUDES',
  'EXCLUDES',
  'STARTS_WITH',
  'ENDS_WITH',
  'GT',
  'GTE',
  'LT',
  'LTE',
])

export const CUSTOMER_QUERY_PERIOD_TOKENS = Object.freeze([
  'TODAY',
  'TOMORROW',
  'THIS_WEEK',
  'NEXT_WEEK',
  'THIS_MONTH',
  'NEXT_MONTH',
  'LAST_30_DAYS',
])

export const CUSTOMER_QUERY_FIELD_DEFINITIONS = Object.freeze(
  listAiQueryableSemanticFields().map((semantic) => {
    const q = semantic.query
    return Object.freeze({
      key: q.key,
      semanticKey: semantic.key,
      label: semantic.label,
      description: semantic.description,
      type: q.type,
      searchable: true,
      operators: Object.freeze([...q.operators]),
      ...(q.enumValues ? { enumValues: Object.freeze([...q.enumValues]) } : {}),
      ...(q.derived ? { derived: q.derived } : {}),
      privacyLevel: semantic.privacyLevel,
      source: `${semantic.storage.table}.${semantic.storage.column}`,
      canonicalValues: semantic.canonicalValues,
    })
  }),
)

const FIELD_BY_KEY = new Map(CUSTOMER_QUERY_FIELD_DEFINITIONS.map((f) => [f.key, f]))

export function getCustomerQueryField(key) {
  return FIELD_BY_KEY.get(String(key ?? '').trim()) ?? null
}

export function listSearchableCustomerQueryFields() {
  return CUSTOMER_QUERY_FIELD_DEFINITIONS.filter((f) => f.searchable)
}

export function listKnownCustomerQueryFields() {
  return [...CUSTOMER_QUERY_FIELD_DEFINITIONS]
}

export function listNonQueryableCustomerQueryFields() {
  return CUSTOMER_QUERY_FIELD_DEFINITIONS.filter((f) => !f.searchable)
}
