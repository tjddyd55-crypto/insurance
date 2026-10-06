import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AI_SEMANTIC_FIELDS,
  AI_SEMANTIC_MANAGED_TABLES,
  getAiSemanticField,
  getAiSemanticFieldByQueryKey,
  listAiQueryableSemanticFields,
} from '../../../shared/ai-assistant/semanticDataCatalog.js'
import { CUSTOMER_QUERY_FIELD_DEFINITIONS } from '../../../shared/ai-assistant/customer-query/customerQuerySchema.js'
import { formatCustomerQuerySchemaForPrompt } from '../../../shared/ai-assistant/customer-query/formatSchemaForPrompt.js'
import { auditSemanticCatalogAgainstDatabaseCatalog } from './semanticCatalogAudit.js'

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
  customer_consultations: [
    'id','customer_id','user_id','ga_id','body','consultation_date','created_at','updated_at',
    'contact_result','follow_up_status','next_contact_date','follow_up_note',
  ],
  todos: [
    'id','tenant_id','ga_id','owner_user_id','assignee_user_id','title','description','due_date','due_time',
    'status','priority','source_type','source_id','related_entity_type','related_entity_id','metadata',
    'created_at','updated_at','completed_at','canceled_at',
  ],
  calendar_items: [
    'id','ga_id','owner_type','owner_id','created_by','assigned_to','item_type','title','description',
    'start_at','end_at','due_date','all_day','status','priority','color','location','visibility',
    'sort_order','deleted_at','created_at','updated_at',
  ],
  customer_claim_requests: [
    'id','agent_id','customer_id','link_id','device_id','request_type','status','title','memo',
    'requester_name','requester_birth_date','requester_phone','submitted_at','processed_at',
    'processed_by_user_id','created_at','updated_at',
  ],
  customer_claim_request_files: [
    'id','request_id','agent_id','customer_id','storage_key','file_name','content_type','file_size',
    'sort_order','uploaded_at','created_at','updated_at',
  ],
  customer_app_profiles: [
    'id','agent_id','customer_id','device_id','name','birth_date','phone','created_at','updated_at',
  ],
  customer_files: [
    'id','customer_id','user_id','ga_id','content','file_name','object_key','file_url','file_size',
    'mime_type','created_at','expires_at','deleted_at',
  ],
  memo: [
    'id','user_id','ga_id','content','x','y','width','height','z_index','font_size','created_at','updated_at','font_weight',
  ],
  user_insurer_accounts: [
    'id','owner_user_id','ga_id','category','company_name','login_id','login_password_encrypted','memo',
    'sort_order','is_custom','is_archived','created_at','updated_at',
  ],
  ta_call_assignments: [
    'id','user_id','customer_id','assignment_date','rotation_round','status','customer_name_snapshot',
    'customer_phone_snapshot','customer_birth_date_snapshot','customer_gender_snapshot','completed_at',
    'created_at','updated_at',
  ],
  customer_relations: [
    'id','customer_id','related_customer_id','user_id','ga_id','created_at',
  ],
  customer_premium_payment_methods: [
    'id','ga_id','owner_user_id','customer_id','insurance_company','policy_number','cardholder_name',
    'card_number_ciphertext','encryption_key_version','card_number_last4','card_brand','card_expiry_month',
    'card_expiry_year','memo','is_active','created_by','updated_by','created_at','updated_at','deleted_at',
  ],
  customer_payment_cards: [
    'id','ga_id','owner_user_id','customer_id','label','card_owner_name','card_number_ciphertext',
    'encryption_key_version','card_number_last4','card_expiry_month','card_expiry_year','is_default',
    'created_by','updated_by','created_at','updated_at','deleted_at',
  ],
  customer_card_payment_contracts: [
    'id','ga_id','owner_user_id','customer_id','payment_card_id','insurance_company','policy_number',
    'product_name','premium_amount','payment_day','memo','status','last_completed_at','created_by',
    'updated_by','created_at','updated_at','deleted_at',
  ],
  customer_card_payment_completions: [
    'id','ga_id','contract_id','customer_id','target_month','completed_at','completed_by','memo','created_at',
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
