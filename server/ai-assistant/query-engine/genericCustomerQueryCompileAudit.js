import { listAiGenericCustomerReadFields } from '../../../shared/ai-assistant/semanticDataCatalog.js'
import { buildGenericCustomerSemanticFilterSql } from './genericCustomerQueryEngine.js'

function sampleFilter(field) {
  const allowed = field.query?.operators?.length ? field.query.operators : null
  const prefer = (op) => !allowed || allowed.includes(op)

  if (field.key === 'customer.labels') {
    return { field: field.key, operator: 'INCLUDES', value: 'VIP' }
  }
  if (field.valueType === 'boolean' && prefer('EQ')) {
    return { field: field.key, operator: 'EQ', value: true }
  }
  if ((field.valueType === 'integer' || field.valueType === 'number') && prefer('EQ')) {
    return { field: field.key, operator: 'EQ', value: 1 }
  }
  if (field.valueType === 'date' || field.valueType === 'datetime') {
    if (prefer('EQ')) return { field: field.key, operator: 'EQ', value: '2026-01-01' }
    if (prefer('BEFORE')) return { field: field.key, operator: 'BEFORE', value: '2026-01-01' }
    if (prefer('AFTER')) return { field: field.key, operator: 'AFTER', value: '2026-01-01' }
    if (prefer('BETWEEN')) return { field: field.key, operator: 'BETWEEN', value: '2026-01-01', valueTo: '2026-01-31' }
    if (prefer('PERIOD')) return { field: field.key, operator: 'PERIOD', value: '2026-01-01', valueTo: '2026-01-31' }
  }
  if (field.valueType === 'enum') {
    const value = field.canonicalValues?.[0] ?? 'sample'
    if (prefer('EQ')) return { field: field.key, operator: 'EQ', value }
    if (prefer('IN')) return { field: field.key, operator: 'IN', value: [value] }
  }
  if (field.valueType === 'json' && prefer('CONTAINS')) {
    return { field: field.key, operator: 'CONTAINS', value: 'sample' }
  }
  if (prefer('EQ')) return { field: field.key, operator: 'EQ', value: 'sample' }
  if (prefer('CONTAINS')) return { field: field.key, operator: 'CONTAINS', value: 'sample' }
  if (prefer('STARTS_WITH')) return { field: field.key, operator: 'STARTS_WITH', value: 'sample' }
  if (prefer('ENDS_WITH')) return { field: field.key, operator: 'ENDS_WITH', value: 'sample' }
  if (prefer('IS_NOT_NULL')) return { field: field.key, operator: 'IS_NOT_NULL', value: null }
  throw new Error('no compile-audit sample operator for ' + field.key)
}

export function auditGenericCustomerQueryCompileCoverage() {
  const fields = listAiGenericCustomerReadFields()
  const failures = []

  for (const field of fields) {
    try {
      const built = buildGenericCustomerSemanticFilterSql([sampleFilter(field)], {
        userPlaceholder: '$1',
        gaPlaceholder: '$2',
        paramStart: 3,
      })
      if (!built.whereFragments?.[0]) {
        throw new Error('empty SQL fragment')
      }
    } catch (error) {
      failures.push({
        semanticKey: field.key,
        table: field.storage.table,
        errorCode: error?.code ?? 'COMPILE_FAILED',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    ok: failures.length === 0,
    genericCustomerFieldCount: fields.length,
    compiledFieldCount: fields.length - failures.length,
    failureCount: failures.length,
    failures,
  }
}
