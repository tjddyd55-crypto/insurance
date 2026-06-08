import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerMapListQuery, buildCustomerMapStatsQuery } from './customerMapQuery.js'

const VISIBILITY = {
  visibilityClause: 'c.ga_id = $1 AND c.deleted_at IS NULL AND COALESCE(c.owner_user_id, c.user_id) = $2',
  visibilityParams: [3, 'user-1'],
}

test('buildCustomerMapListQuery scopes to visibility clause with success locations', () => {
  const { sql, params } = buildCustomerMapListQuery({
    ...VISIBILITY,
    userId: 'user-1',
    gaId: 3,
  })
  assert.match(sql, /COALESCE\(c\.owner_user_id, c\.user_id\) = \$2/)
  assert.match(sql, /cl\.status = 'success'/)
  assert.deepEqual(params.slice(0, 2), [3, 'user-1'])
  assert.equal(params.at(-2), 'user-1')
  assert.equal(params.at(-1), 3)
})

test('buildCustomerMapListQuery adds radius filter', () => {
  const { sql, params } = buildCustomerMapListQuery({
    ...VISIBILITY,
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

test('buildCustomerMapStatsQuery counts address and geocode buckets', () => {
  const { sql } = buildCustomerMapStatsQuery(VISIBILITY)
  assert.match(sql, /total_customers/)
  assert.match(sql, /with_address/)
  assert.match(sql, /without_address/)
  assert.match(sql, /geocoded_success/)
  assert.match(sql, /geocode_pending/)
  assert.match(sql, /geocode_failed/)
  assert.doesNotMatch(sql, /missing_address/)
})
