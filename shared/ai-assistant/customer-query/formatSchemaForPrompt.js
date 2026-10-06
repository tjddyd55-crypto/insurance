import { CUSTOMER_QUERY_OPERATORS, CUSTOMER_QUERY_PERIOD_TOKENS } from './customerQuerySchema.js'
import { listAiGenericCustomerReadFields } from '../semanticDataCatalog.js'

function inferOperators(field) {
  if (field.query?.operators?.length) return field.query.operators
  switch (field.valueType) {
    case 'boolean': return ['EQ', 'IS_NULL', 'IS_NOT_NULL']
    case 'integer':
    case 'number': return ['EQ', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL']
    case 'date':
    case 'datetime': return ['EQ', 'BEFORE', 'AFTER', 'BETWEEN', 'PERIOD', 'IS_NULL', 'IS_NOT_NULL']
    case 'enum': return ['EQ', 'IN', 'IS_NULL', 'IS_NOT_NULL']
    case 'json': return ['EQ', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL']
    case 'relation':
      if (field.key === 'customer.labels') return ['INCLUDES', 'EXCLUDES']
      return ['EQ', 'CONTAINS']
    default: return ['EQ', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'IS_NULL', 'IS_NOT_NULL']
  }
}

export function formatCustomerQuerySchemaForPrompt() {
  const fields = listAiGenericCustomerReadFields()
    .map((f) => {
      const enumPart = f.canonicalValues?.length ? ' canonical(' + f.canonicalValues.join(',') + ')' : ''
      return '- ' + f.key + ' [' + f.label + ']: ' + f.valueType + enumPart + ' ops=' + inferOperators(f).join('|') + ' — ' + f.description
    })
    .join('\n')

  return `CUSTOMER semantic customerQuery (structured filters, AND only):
${fields}
Operators: ${CUSTOMER_QUERY_OPERATORS.join(', ')}
Date PERIOD tokens: ${CUSTOMER_QUERY_PERIOD_TOKENS.join(', ')}
Rules:
- Understand the user's free-form wording semantically and choose the canonical semantic field key above. Never route by a fixed synonym/keyword dictionary.
- Put the canonical semantic key in customerQuery.filters[].field (example: customer.gender, consultation.nextContactDate, paymentContract.insuranceCompany).
- Do not invent fields, tables, joins or SQL.
- Only fields listed above are available to the generic customer query engine.
- INTERNAL_SYSTEM and SECRET_SECURITY fields are intentionally excluded.
- gender values are MALE/FEMALE or canonical male/female; server normalizes them.
- customer.labels uses INCLUDES/EXCLUDES.
- For dates prefer PERIOD tokens when the user's request is relative.
- If the requested concept is not listed, set unsupportedField to the concept and return empty filters.
- LIST/COUNT with semantic filters → requiredToolKey customer.list.
- Single customer name/phone lookup may still use customer.search.
- Put all structured conditions in customerQuery.filters[].`
}

export function formatCustomerQueryableFieldsHelp() {
  const labels = [...new Set(listAiGenericCustomerReadFields().map((f) => f.label))]
  return '고객은 ' + labels.join(', ') + ' 등의 업무 데이터로 조회할 수 있습니다. 원하는 조건을 말씀해 주세요.'
}
