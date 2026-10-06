import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AI_SEMANTIC_FIELDS,
  AI_SEMANTIC_MANAGED_TABLES,
  getAiSemanticField,
  getAiSemanticFieldByQueryKey,
  listAiQueryableSemanticFields,
} from './semanticDataCatalog.js'
import { CUSTOMER_QUERY_FIELD_DEFINITIONS } from './customer-query/customerQuerySchema.js'
import { formatCustomerQuerySchemaForPrompt } from './customer-query/formatSchemaForPrompt.js'
import { auditSemanticCatalogAgainstDatabaseCatalog } from '../../server/ai-assistant/data-catalog/semanticCatalogAudit.js'

const KNOWN_DB_COLUMNS = {
  customers: [
    'id','user_id','name','ssn','phone','carrier','address','height','weight','job','driving','medical',
    'created_at','ga_id','car_number','car_model','car_year','renewal_date','deleted_at','gender',
    'insurance_age','next_age_date','is_driver','car_type','notes','is_favorite','sms_opt_out',
    'birth_date','customer_code','crm_extension','inflow_source','inflow_source_note','referrer_name',
    'address_sido','address_sigungu','address_eupmyeondong','tenant_id','owner_user_id',
    'created_by_user_id','visibility_scope','business_representative_name','business_number',
    'business_address','business_memo',
  ],
  customer_cars: [
    'id','customer_id','user_id','ga_id','car_type','car_number','car_model','car_year','renewal_date',
    'memo','is_primary','sort_order','created_at','updated_at',
  ],
  customer_fire_insurance_locations: [
    'id','customer_id','user_id','ga_id','address','memo','sort_order','deleted_at','created_at','updated_at',
  ],
  customer_special_dates: [
    'id','customer_id','user_id','ga_id','purpose_type','title','date_value','memo','sort_order',
    'deleted_at','created_at','updated_at',
  ],
  customer_custom_fields: [
    'id','customer_id','user_id','ga_id','label','value','sort_order','deleted_at','created_at','updated_at',
  ],
}

function fakeDbCatalog() {
  const tables = Object.entries(KNOWN_DB_COLUMNS).map(([tableName, columns]) => ({
    tableName,
    columns: columns.map((columnName) => ({ columnName })),
  }))
  return {
    tableCount: tables.length,
    columnCount: tables.reduce((n, t) => n + t.columns.length, 0),
    tables,
  }
}

describe('AI semantic data catalog SSOT', () => {
  it('has unique semantic and query keys', () => {
    assert.equal(new Set(AI_SEMANTIC_FIELDS.map((f) => f.key)).size, AI_SEMANTIC_FIELDS.length)
    const queryable = listAiQueryableSemanticFields()
    assert.equal(new Set(queryable.map((f) => f.query.key)).size, queryable.length)
  })

  it('does not encode natural-language synonym dictionaries', () => {
    for (const f of AI_SEMANTIC_FIELDS) {
      assert.equal(Object.hasOwn(f, 'aliases'), false)
      assert.equal(Object.hasOwn(f, 'synonyms'), false)
      assert.equal(Object.hasOwn(f, 'keywords'), false)
    }
  })

  it('defines gender from meaning through canonical DB storage', () => {
    const gender = getAiSemanticField('customer.gender')
    assert.equal(gender.label, '성별')
    assert.deepEqual(gender.storage, { table: 'customers', column: 'gender' })
    assert.deepEqual(gender.canonicalValues, ['male', 'female'])
    assert.equal(gender.query.key, 'gender')
    assert.deepEqual(gender.query.enumValues, ['MALE', 'FEMALE'])
    assert.equal(getAiSemanticFieldByQueryKey('gender')?.key, 'customer.gender')
  })

  it('customer query schema is derived from semantic catalog', () => {
    const semanticQueryKeys = listAiQueryableSemanticFields().map((f) => f.query.key).sort()
    const querySchemaKeys = CUSTOMER_QUERY_FIELD_DEFINITIONS.map((f) => f.key).sort()
    assert.deepEqual(querySchemaKeys, semanticQueryKeys)
  })

  it('GPT prompt contains business meaning, not a synonym list', () => {
    const prompt = formatCustomerQuerySchemaForPrompt()
    assert.match(prompt, /gender \[성별\]/)
    assert.match(prompt, /고객 성별/)
    assert.match(prompt, /canonical\(male,female\)/)
    assert.match(prompt, /free-form wording semantically/)
  })

  it('covers every known column in all managed customer tables', () => {
    assert.deepEqual([...AI_SEMANTIC_MANAGED_TABLES].sort(), Object.keys(KNOWN_DB_COLUMNS).sort())
    const audit = auditSemanticCatalogAgainstDatabaseCatalog(fakeDbCatalog())
    assert.equal(audit.ok, true, JSON.stringify(audit.issues))
    assert.equal(audit.missingDefinitionCount, 0)
    assert.equal(audit.missingStorageCount, 0)
    assert.equal(audit.duplicateQueryKeyCount, 0)
  })

  it('detects a new DB column that has no meaning definition', () => {
    const db = fakeDbCatalog()
    db.tables.find((t) => t.tableName === 'customers').columns.push({ columnName: 'future_field' })
    const audit = auditSemanticCatalogAgainstDatabaseCatalog(db)
    assert.equal(audit.ok, false)
    assert.ok(audit.issues.some((i) => i.code === 'SEMANTIC_DEFINITION_MISSING' && i.storageKey === 'customers.future_field'))
  })
})
