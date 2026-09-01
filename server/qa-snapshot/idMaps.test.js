import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createIdMaps,
  recordIdMapping,
  remapRelationRow,
  remapTodoCustomerReferences,
} from './idMaps.js'

test('고객 관계의 양쪽 ID를 명시적 고객 ID 맵으로 치환한다', () => {
  const maps = createIdMaps()
  recordIdMapping(maps, 'customers', 10, 110)
  recordIdMapping(maps, 'customers', 20, 120)

  assert.deepEqual(remapRelationRow({
    id: 1,
    customer_id: 10,
    related_customer_id: 20,
  }, maps), {
    id: 1,
    customer_id: 110,
    related_customer_id: 120,
  })
})

test('할 일의 논리 고객 참조와 JSON 참조를 함께 치환한다', () => {
  const maps = createIdMaps()
  recordIdMapping(maps, 'customers', 10, 110)
  const row = remapTodoCustomerReferences({
    related_entity_id: '10',
    source_id: '10',
    metadata: { customerId: 10 },
  }, maps)

  assert.equal(row.related_entity_id, '110')
  assert.equal(row.source_id, '110')
  assert.equal(row.metadata.customerId, 110)
})
