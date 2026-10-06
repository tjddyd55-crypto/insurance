import {
  listNonQueryableCustomerQueryFields,
  listSearchableCustomerQueryFields,
} from './customerQuerySchema.js'
import { CUSTOMER_QUERY_OPERATORS, CUSTOMER_QUERY_PERIOD_TOKENS } from './customerQuerySchema.js'

/**
 * Compact schema for intent classifier (not full DB DDL).
 */
export function formatCustomerQuerySchemaForPrompt() {
  const fields = listSearchableCustomerQueryFields()
    .map((f) => {
      const enumPart = f.enumValues?.length ? ` enum(${f.enumValues.join(',')})` : ''
      return `- ${f.key}: ${f.type}${enumPart} ops=${f.operators.join('|')}`
    })
    .join('\n')
  const knownButNotQueryable = listNonQueryableCustomerQueryFields()
    .map((f) => `${f.key}(${f.label})`)
    .join(', ')
  return `CUSTOMER customerQuery (structured filters, AND only):
${fields}
Known CRM fields not queryable by AI yet: ${knownButNotQueryable || 'none'}
Operators: ${CUSTOMER_QUERY_OPERATORS.join(', ')}
Date PERIOD tokens: ${CUSTOMER_QUERY_PERIOD_TOKENS.join(', ')}
Rules:
- Map user meaning to field+operator+value. Do not invent fields.
- gender values: MALE or FEMALE (not Korean words in value).
- labels INCLUDES = customer tag/label (e.g. VIP), not UI field names.
- insurer = primary insurer name string.
- For dates prefer PERIOD token over raw YYYY-MM-DD.
- If user asks for a known-but-not-queryable CRM field, set unsupportedField to that field key and empty filters.
- If user asks for a concept with no known CRM field, set unsupportedField (e.g. bloodType) and empty filters.
- LIST with filters → requiredToolKey customer.list; single name/phone lookup → customer.search.
- Put filters in customerQuery.filters[], not keyword routing.`
}

export function formatCustomerQueryableFieldsHelp() {
  const labels = listSearchableCustomerQueryFields().map((f) => f.label)
  return `고객은 ${labels.join(', ')} 등으로 조회할 수 있습니다. 원하는 조건을 말씀해 주세요.`
}
