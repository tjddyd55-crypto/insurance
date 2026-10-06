import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AI_SEMANTIC_DATA_CLASS,
  AI_SEMANTIC_DOMAIN,
  getAiSemanticField,
  listAiGenericCustomerReadFields,
  summarizeAiSemanticCatalog,
} from '../../../shared/ai-assistant/semanticDataCatalog.js'
import { validateCustomerQueryAst } from '../../../shared/ai-assistant/customer-query/validateCustomerQuery.js'
import { buildGenericCustomerSemanticFilterSql } from './genericCustomerQueryEngine.js'

const CTX = {
  userPlaceholder: '$1',
  gaPlaceholder: '$2',
  paramStart: 3,
}

describe('generic customer semantic query engine', () => {
  it('classifies user business, internal and secret fields', () => {
    assert.equal(getAiSemanticField('customer.name')?.dataClass, AI_SEMANTIC_DATA_CLASS.USER_BUSINESS)
    assert.equal(getAiSemanticField('customer.ownerUserId')?.dataClass, AI_SEMANTIC_DATA_CLASS.INTERNAL_SYSTEM)
    assert.equal(getAiSemanticField('paymentCard.numberCiphertext')?.dataClass, AI_SEMANTIC_DATA_CLASS.SECRET_SECURITY)
    assert.equal(getAiSemanticField('customer.name')?.semanticDomain, AI_SEMANTIC_DOMAIN.CUSTOMER)
    assert.equal(getAiSemanticField('memo.content')?.semanticDomain, AI_SEMANTIC_DOMAIN.USER_WORKSPACE)
  })

  it('only exposes customer user-business fields to the generic engine', () => {
    const fields = listAiGenericCustomerReadFields()
    assert.ok(fields.length > 0)
    assert.ok(fields.every((f) => f.dataClass === AI_SEMANTIC_DATA_CLASS.USER_BUSINESS))
    assert.ok(fields.every((f) => f.semanticDomain === AI_SEMANTIC_DOMAIN.CUSTOMER))
    assert.ok(!fields.some((f) => f.key === 'paymentCard.numberCiphertext'))
    assert.ok(!fields.some((f) => f.key === 'customer.ownerUserId'))
    assert.ok(!fields.some((f) => f.key === 'memo.content'))
  })

  it('validates legacy query keys into canonical semantic keys', () => {
    const result = validateCustomerQueryAst({
      logic: 'AND',
      filters: [{ field: 'gender', operator: 'EQ', value: 'MALE', valueTo: null }],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(result.ok, true)
    assert.equal(result.ast.filters[0].semanticKey, 'customer.gender')
    assert.equal(result.ast.filters[0].value, 'male')
  })

  it('validates generic semantic keys that had no dedicated query code', () => {
    const result = validateCustomerQueryAst({
      logic: 'AND',
      filters: [
        { field: 'consultation.nextContactDate', operator: 'PERIOD', value: 'THIS_WEEK', valueTo: null },
        { field: 'paymentContract.insuranceCompany', operator: 'CONTAINS', value: '현대해상', valueTo: null },
        { field: 'claim.status', operator: 'EQ', value: 'processing', valueTo: null },
      ],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(result.ok, true, result.message)
    assert.deepEqual(
      result.ast.filters.map((f) => f.semanticKey),
      ['consultation.nextContactDate', 'paymentContract.insuranceCompany', 'claim.status'],
    )
  })

  it('compiles direct customer fields without user-provided identifiers', () => {
    const built = buildGenericCustomerSemanticFilterSql([
      { field: 'customer.gender', operator: 'EQ', value: 'male' },
      { field: 'customer.address', operator: 'CONTAINS', value: '서울' },
    ], CTX)
    assert.equal(built.whereFragments.length, 2)
    assert.match(built.whereFragments[0], /c\.gender/)
    assert.match(built.whereFragments[1], /c\.address/)
    assert.deepEqual(built.params, ['male', '%서울%'])
  })

  it('compiles related customer business fields as scoped EXISTS queries', () => {
    const built = buildGenericCustomerSemanticFilterSql([
      { field: 'consultation.nextContactDate', operator: 'BETWEEN', value: '2026-10-05', valueTo: '2026-10-11' },
      { field: 'paymentContract.insuranceCompany', operator: 'CONTAINS', value: '현대해상' },
      { field: 'customerFile.fileName', operator: 'CONTAINS', value: '청구' },
    ], CTX)

    const sql = built.whereFragments.join('\n')
    assert.match(sql, /FROM customer_consultations gc_consult/)
    assert.match(sql, /gc_consult\.customer_id = c\.id/)
    assert.match(sql, /gc_consult\.user_id = \$1::text/)
    assert.match(sql, /gc_consult\.ga_id = \$2::integer/)
    assert.match(sql, /FROM customer_card_payment_contracts gc_payment_contract/)
    assert.match(sql, /gc_payment_contract\.deleted_at IS NULL/)
    assert.match(sql, /FROM customer_files gc_file/)
    assert.match(sql, /gc_file\.deleted_at IS NULL/)
    assert.deepEqual(built.semanticKeys, [
      'consultation.nextContactDate',
      'paymentContract.insuranceCompany',
      'customerFile.fileName',
    ])
  })

  it('blocks internal/system and secret/security fields', () => {
    assert.throws(
      () => buildGenericCustomerSemanticFilterSql([
        { field: 'customer.ownerUserId', operator: 'EQ', value: 'x' },
      ], CTX),
      (error) => error?.code === 'SEMANTIC_FIELD_NOT_QUERYABLE',
    )
    assert.throws(
      () => buildGenericCustomerSemanticFilterSql([
        { field: 'paymentCard.numberCiphertext', operator: 'CONTAINS', value: '1234' },
      ], CTX),
      (error) => error?.code === 'SEMANTIC_FIELD_NOT_QUERYABLE',
    )
  })

  it('keeps catalog classification counts visible for diagnostics', () => {
    const summary = summarizeAiSemanticCatalog()
    assert.ok(summary.genericCustomerReadCount > 0)
    assert.ok(summary.dataClassCounts.USER_BUSINESS > 0)
    assert.ok(summary.dataClassCounts.INTERNAL_SYSTEM > 0)
    assert.ok(summary.dataClassCounts.SECRET_SECURITY > 0)
  })
})
