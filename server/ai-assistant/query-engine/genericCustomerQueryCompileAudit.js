import { listAiGenericCustomerReadFields } from '../../../shared/ai-assistant/semanticDataCatalog.js'
import { buildGenericCustomerSemanticFilterSql } from './genericCustomerQueryEngine.js'

function sampleFilter(field) {
  if (field.key === 'customer.labels') {
    return { field: field.key, operator: 'INCLUDES', value: 'VIP' }
  }
  if (field.query?.operators?.includes('EQ')) {
    if (field.valueType === 'boolean') return { field: field.key, operator: 'EQ', value: true }
    if (field.valueType === 'integer' || field.valueType === 'number') return { field: field.key, operator: 'EQ', value: 1 }
    if (field.valueType === 'date' || field.valueType === 'datetime') return { field: field.key, operator: 'EQ', value: '2026-01-01' }
    if (field.valueType === 'enum') return { field: field.key, operator: 'EQ', value: field.canonicalValues?.[0] ?? 'sample' }
    return { field: field.key, operator: 'EQ', value: 'sample' }
  }
  if (field.valueType === 'boolean') return { field: field.key, operator: 'EQ', value: true }
  if (field.valueType === 'integer' || field.valueType === 'number') return { field: field.key, operator: 'EQ', value: 1 }
  if (field.valueType === 'date' || field.valueType === 'datetime') return { field: field.key, operator: 'EQ', value: '2026-01-01' }
  if (field.valueType === 'enum') return { field: field.key, operator: 'EQ', value: field.canonicalValues?.[0] ?? 'sample' }
  if (field.valueType === 'json') return { field: field.key, operator: 'CONTAINS', value: 'sample' }
  return { field: field.key, operator: 'CONTAINS', value: 'sample' }
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
