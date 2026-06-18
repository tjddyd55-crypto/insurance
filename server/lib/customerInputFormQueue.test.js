import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  INITIAL_CUSTOMER_FORM_ID_SEQ,
  INITIAL_CUSTOMER_FORM_LOCAL_ID,
  createCustomerFormLocalId,
  removeCustomerInputFormItem,
} from '../../src/features/customers/lib/customerInputFormQueue.ts'

const pagePath = path.join(process.cwd(), 'src/features/customers/pages/CustomerInputPage.tsx')

describe('customer input form queue', () => {
  it('allocates unique localIds after the initial form', () => {
    assert.equal(INITIAL_CUSTOMER_FORM_LOCAL_ID, 'customer-form-1')
    assert.equal(createCustomerFormLocalId(INITIAL_CUSTOMER_FORM_ID_SEQ + 1), 'customer-form-2')
    assert.equal(createCustomerFormLocalId(INITIAL_CUSTOMER_FORM_ID_SEQ + 2), 'customer-form-3')
  })

  it('removes only the targeted non-first form', () => {
    const forms = [
      { localId: 'customer-form-1', values: { name: 'A' } },
      { localId: 'customer-form-2', values: { name: 'B' } },
      { localId: 'customer-form-3', values: { name: 'C' } },
    ]
    const next = removeCustomerInputFormItem(forms, 'customer-form-2')
    assert.deepEqual(
      next.map((row) => row.localId),
      ['customer-form-1', 'customer-form-3'],
    )
  })

  it('does not remove the first form even when localId matches', () => {
    const forms = [
      { localId: 'customer-form-1', values: { name: 'A' } },
      { localId: 'customer-form-2', values: { name: 'B' } },
    ]
    const next = removeCustomerInputFormItem(forms, 'customer-form-1')
    assert.equal(next.length, 2)
  })

  it('uses type=button delete handlers and numbered labels', () => {
    const src = fs.readFileSync(pagePath, 'utf8')
    assert.match(src, /고객 \{index \+ 1\} 삭제/)
    assert.match(src, /event\.preventDefault\(\)/)
    assert.match(src, /event\.stopPropagation\(\)/)
    assert.match(src, /INITIAL_CUSTOMER_FORM_ID_SEQ/)
  })
})
