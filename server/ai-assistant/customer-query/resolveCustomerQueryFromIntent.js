import { validateCustomerQueryAst } from '../../../shared/ai-assistant/customer-query/validateCustomerQuery.js'

/**
 * @param {object} classified
 */
export function extractCustomerQueryFromIntent(classified) {
  const raw = classified.customerQuery ?? classified.filters?.customerQuery ?? null
  if (Array.isArray(classified.filters) && classified.filters.length > 0) {
    return validateCustomerQueryAst({
      logic: 'AND',
      filters: classified.filters,
      sort: classified.sort ?? [],
      limit: classified.limit ?? 20,
      unsupportedField: null,
    })
  }
  return validateCustomerQueryAst(raw)
}

/**
 * @param {object} ast
 */
export function summarizeCustomerQueryForLog(ast) {
  if (!ast?.filters?.length) {
    return { filterFields: [], operators: [] }
  }
  return {
    filterFields: ast.filters.map((f) => f.field),
    operators: ast.filters.map((f) => f.operator),
  }
}
