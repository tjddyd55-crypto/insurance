import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerMapListQuery, buildCustomerMapStatsQuery } from './customerMapQuery.js'

test('buildCustomerMapListQuery scopes to own customers with success locations', () => {
  const { sql, params } = buildCustomerMapListQuery({
    userId: 'user-1',
    gaId: 3,
  })
  assert.match(sql, /COALESCE\(c\.owner_user_id, c\.user_id\) = \$2/)
  assert.match(sql, /cl\.status = 'success'/)
  assert.deepEqual(params, [3, 'user-1'])
})

test('buildCustomerMapListQuery adds radius filter', () => {
  const { sql, params } = buildCustomerMapListQuery({
    userId: 'u',
    gaId: 1,
    centerLat: 37.5,
    centerLng: 127.0,
    radiusKm: 3,
  })
  assert.match(sql, /acos\(/)
  assert.equal(params[2], 37.5)
  assert.equal(params[3], 127)
  assert.equal(params[4], 3)
})

test('buildCustomerMapStatsQuery counts by status', () => {
  const { sql } = buildCustomerMapStatsQuery({ userId: 'u', gaId: 2 })
  assert.match(sql, /geocode_failed/)
  assert.match(sql, /missing_address/)
})
