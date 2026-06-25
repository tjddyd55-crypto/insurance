import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { areFkColumnTypesCompatible } from './dbFkTypeGuard.js'

describe('dbFkTypeGuard', () => {
  it('accepts matching udt_name', () => {
    assert.equal(
      areFkColumnTypesCompatible({ udt_name: 'text' }, { udt_name: 'text' }),
      true,
    )
  })

  it('accepts compatible integer families', () => {
    assert.equal(
      areFkColumnTypesCompatible({ udt_name: 'int4' }, { udt_name: 'int8' }),
      true,
    )
  })

  it('accepts compatible text families', () => {
    assert.equal(
      areFkColumnTypesCompatible({ udt_name: 'varchar' }, { udt_name: 'text' }),
      true,
    )
  })

  it('rejects integer to text mismatch', () => {
    assert.equal(
      areFkColumnTypesCompatible({ udt_name: 'int4' }, { udt_name: 'text' }),
      false,
    )
  })

  it('rejects missing type info', () => {
    assert.equal(areFkColumnTypesCompatible(null, { udt_name: 'text' }), false)
  })
})
