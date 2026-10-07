import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applySourceColumnMapping,
  CUSTOMER_IMPORT_MAPPING_IGNORE,
  validateUserColumnMapping,
} from './mappingEdit.js'

describe('mapping edit validation', () => {
  it('rejects unknown destination fields', () => {
    assert.throws(
      () => validateUserColumnMapping({ col_0: 'password' }, ['이름']),
      (e) => e.code === 'INVALID_DESTINATION_FIELD',
    )
  })

  it('allows ignore sentinel via delete', () => {
    const next = applySourceColumnMapping({ col_0: 'name' }, ['회사'], '회사', CUSTOMER_IMPORT_MAPPING_IGNORE)
    assert.equal(next.col_0, undefined)
  })
})
