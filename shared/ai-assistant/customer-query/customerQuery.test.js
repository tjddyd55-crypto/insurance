import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateCustomerQueryAst } from './validateCustomerQuery.js'
import { resolveCustomerQueryPeriod } from './resolvePeriodToken.js'
import { buildCustomerStructuredFilterSql } from '../../../server/lib/customerStructuredListFilters.js'

describe('customer query engine', () => {
  it('validates gender filter', () => {
    const r = validateCustomerQueryAst({
      logic: 'AND',
      filters: [{ field: 'gender', operator: 'EQ', value: 'FEMALE', valueTo: null }],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(r.ok, true)
    assert.equal(r.ast.filters[0].value, 'female')
  })

  it('rejects unknown field', () => {
    const r = validateCustomerQueryAst({
      logic: 'AND',
      filters: [{ field: 'bloodType', operator: 'EQ', value: 'O', valueTo: null }],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'UNKNOWN_FIELD')
  })

  it('unsupported field token', () => {
    const r = validateCustomerQueryAst({
      logic: 'AND',
      filters: [],
      sort: [],
      limit: 20,
      unsupportedField: 'bloodType',
    })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'UNSUPPORTED_FIELD')
  })

  it('rejects invalid operator for gender', () => {
    const r = validateCustomerQueryAst({
      logic: 'AND',
      filters: [{ field: 'gender', operator: 'CONTAINS', value: 'FEMALE', valueTo: null }],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'INVALID_OPERATOR')
  })

  it('compiles multiple filters to SQL fragments', () => {
    const validated = validateCustomerQueryAst({
      logic: 'AND',
      filters: [
        { field: 'gender', operator: 'EQ', value: 'FEMALE', valueTo: null },
        { field: 'labels', operator: 'INCLUDES', value: 'VIP', valueTo: null },
        { field: 'address', operator: 'CONTAINS', value: '서울', valueTo: null },
      ],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(validated.ok, true)
    const sql = buildCustomerStructuredFilterSql(validated.ast.filters, {
      userPlaceholder: '$5',
      gaPlaceholder: '$6',
      paramStart: 7,
    })
    assert.equal(sql.whereFragments.length, 3)
    assert.match(sql.whereFragments.join(' '), /c\.gender/)
    assert.match(sql.whereFragments.join(' '), /customer_custom_fields/)
  })

  it('period token resolves THIS_MONTH', () => {
    const r = resolveCustomerQueryPeriod('THIS_MONTH', '2026-10-05')
    assert.equal(r?.from, '2026-10-01')
    assert.equal(r?.to, '2026-10-31')
  })

  it('rejects sql injection in string value', () => {
    const r = validateCustomerQueryAst({
      logic: 'AND',
      filters: [{ field: 'name', operator: 'CONTAINS', value: "'; DROP TABLE customers;--", valueTo: null }],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(r.ok, true)
    const sql = buildCustomerStructuredFilterSql(r.ast.filters, {
      userPlaceholder: '$1',
      gaPlaceholder: '$2',
      paramStart: 3,
    })
    assert.equal(sql.params[0], "%'; DROP TABLE customers;--%")
  })


  it('validates boolean and additional base fields', () => {
    const result = validateCustomerQueryAst({
      logic: 'AND',
      filters: [
        { field: 'isDriver', operator: 'EQ', value: true, valueTo: null },
        { field: 'carYear', operator: 'EQ', value: '2022', valueTo: null },
      ],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(result.ok, true)
    assert.equal(result.ast.filters[0].value, true)
  })

  it('knows sensitive CRM fields but refuses AI query until explicitly enabled', () => {
    const result = validateCustomerQueryAst({
      logic: 'AND',
      filters: [{ field: 'medical', operator: 'CONTAINS', value: '고혈압', valueTo: null }],
      sort: [],
      limit: 20,
      unsupportedField: null,
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'UNSUPPORTED_FIELD')
  })
})
