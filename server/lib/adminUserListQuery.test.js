import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAdminUserOrderClause,
  parseAdminUserSort,
  resolveKstMonthBoundsUtc,
} from './adminUserListQuery.js'

test('parseAdminUserSort defaults to created_desc', () => {
  assert.equal(parseAdminUserSort(''), 'created_desc')
  assert.equal(parseAdminUserSort(undefined), 'created_desc')
  assert.equal(parseAdminUserSort('name_asc'), 'name_asc')
})

test('buildAdminUserOrderClause uses created_at DESC by default', () => {
  assert.match(buildAdminUserOrderClause('created_desc'), /u\.created_at DESC/)
  assert.match(buildAdminUserOrderClause('created_desc'), /u\.id DESC/)
})

test('resolveKstMonthBoundsUtc covers October 2026 in KST', () => {
  const ref = new Date('2026-10-11T10:00:00+09:00')
  const { start, end } = resolveKstMonthBoundsUtc(ref)
  assert.equal(start.toISOString(), '2026-09-30T15:00:00.000Z')
  assert.equal(end.toISOString(), '2026-10-31T15:00:00.000Z')
})
