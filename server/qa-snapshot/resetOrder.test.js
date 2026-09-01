import assert from 'node:assert/strict'
import test from 'node:test'
import { getResetDeleteOrder } from './loader.js'

test('reset은 자식 행을 부모 행보다 먼저 삭제한다', () => {
  const order = getResetDeleteOrder()
  const before = (child, parent) => {
    assert.ok(order.indexOf(child) < order.indexOf(parent), `${child} must precede ${parent}`)
  }

  before('customer_claim_request_files', 'customer_claim_requests')
  before('customer_claim_requests', 'customer_app_links')
  before('customer_relation_group_members', 'customer_relation_groups')
  before('customer_relation_groups', 'customers')
  before('customer_relations', 'customers')
  before('ta_call_assignments', 'customers')
})
