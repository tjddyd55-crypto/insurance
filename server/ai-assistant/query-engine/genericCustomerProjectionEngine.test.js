import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildGenericCustomerProjectionSelect,
  mapCustomerProjectionRow,
  normalizeCustomerReturnFields,
} from './genericCustomerProjectionEngine.js'

const CTX = {
  userPlaceholder: '$1',
  gaPlaceholder: '$2',
}

describe('generic customer semantic projection engine', () => {
  it('accepts user-business customer fields and rejects duplicates', () => {
    const fields = normalizeCustomerReturnFields([
      'customer.address',
      'customer.address',
      'customer.phone',
    ])
    assert.deepEqual(fields, ['customer.address', 'customer.phone'])
  })

  it('blocks internal and secret fields', () => {
    assert.throws(
      () => normalizeCustomerReturnFields(['customer.ownerUserId']),
      (error) => error?.code === 'SEMANTIC_FIELD_NOT_READABLE',
    )
    assert.throws(
      () => normalizeCustomerReturnFields(['paymentCard.numberCiphertext']),
      (error) => error?.code === 'SEMANTIC_FIELD_NOT_READABLE',
    )
  })

  it('compiles direct customer projection', () => {
    const plan = buildGenericCustomerProjectionSelect(['customer.address'], CTX)
    assert.equal(plan.returnFields[0], 'customer.address')
    assert.match(plan.selectFragments[0], /c\.address AS ai_projection_0/)
  })

  it('compiles related projection with customer scope', () => {
    const plan = buildGenericCustomerProjectionSelect(
      ['paymentContract.insuranceCompany', 'customerFile.fileName'],
      CTX,
    )
    const sql = plan.selectFragments.join('\n')
    assert.match(sql, /FROM customer_card_payment_contracts gc_payment_contract/)
    assert.match(sql, /gc_payment_contract\.customer_id = c\.id/)
    assert.match(sql, /gc_payment_contract\.owner_user_id = \$1::text/)
    assert.match(sql, /gc_payment_contract\.ga_id = \$2::integer/)
    assert.match(sql, /FROM customer_files gc_file/)
    assert.match(sql, /gc_file\.deleted_at IS NULL/)
  })

  it('maps projection rows back to semantic labels', () => {
    const plan = buildGenericCustomerProjectionSelect(
      ['customer.address', 'vehicle.carNumber'],
      CTX,
    )
    const mapped = mapCustomerProjectionRow(
      {
        ai_projection_0: '부산광역시 해운대구 QA로 2',
        ai_projection_1: ['12가3456', '34나5678'],
      },
      plan,
    )
    assert.deepEqual(mapped[0], {
      semanticKey: 'customer.address',
      label: '주소',
      valueType: 'string',
      value: '부산광역시 해운대구 QA로 2',
    })
    assert.deepEqual(mapped[1].value, ['12가3456', '34나5678'])
  })
})
