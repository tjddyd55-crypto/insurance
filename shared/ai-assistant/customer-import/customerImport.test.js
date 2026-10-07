import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildAnalyzeResultForMatrix } from './fileAnalyze.js'
import { normalizeImportPhone } from './normalize.js'
import { validateMappedCustomerRow } from './validate.js'
import { findInFileDuplicateFlags } from './duplicate.js'
import { suggestAliasColumnMapping } from './fieldDictionary.js'

describe('customer import shared', () => {
  it('detects header below title row', () => {
    const matrix = [
      ['2026 고객 명부'],
      [],
      ['이름', '휴대폰번호', '주소'],
      ['김철수', '010-1234-5678', '서울'],
    ]
    const result = buildAnalyzeResultForMatrix(matrix, null)
    assert.ok(result.headerRowIndex >= 0)
    assert.ok(result.headers.some((h) => h.includes('이름') || h.includes('휴대')))
  })

  it('normalizes phone variants', () => {
    assert.equal(normalizeImportPhone('010-1234-5678').normalized, '01012345678')
    assert.equal(normalizeImportPhone('010 1234 5678').valid, true)
    assert.equal(normalizeImportPhone(1012345678).valid, true)
  })

  it('validates missing name as invalid', () => {
    const r = validateMappedCustomerRow({ phone: '01012345678' })
    assert.equal(r.status, 'INVALID')
  })

  it('alias mapping maps Korean headers', () => {
    const mapping = suggestAliasColumnMapping(['성명', 'H.P', '비고'])
    assert.equal(mapping.col_0, 'name')
    assert.equal(mapping.col_1, 'phone')
    assert.equal(mapping.col_2, 'memo')
  })

  it('flags in-file duplicate by phone+name', () => {
    const rows = [
      { rowId: 'a', mapped: { name: 'Kim', phone: '01011112222' } },
      { rowId: 'b', mapped: { name: 'Kim', phone: '01011112222' } },
    ]
    const flags = findInFileDuplicateFlags(rows)
    assert.equal(flags.get('a'), 'DUPLICATE_IN_FILE')
    assert.equal(flags.get('b'), 'DUPLICATE_IN_FILE')
  })
})
