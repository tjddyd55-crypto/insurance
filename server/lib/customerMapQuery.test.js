import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerMapListQuery, buildCustomerMapStatsQuery, buildCustomerMapUnmappedQuery } from './customerMapQuery.js'

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
    sortByDistance: true,
  })
  assert.match(sql, /acos\(/)
  assert.match(sql, /ORDER BY/)
  assert.equal(params[2], 37.5)
  assert.equal(params[3], 127)
  assert.equal(params[4], 3)
})

test('buildCustomerMapListQuery adds viewport bounds filter', () => {
  const { sql, params } = buildCustomerMapListQuery({
    ...VISIBILITY,
    userId: 'u',
    gaId: 1,
    boundsNorth: 37.7,
    boundsSouth: 37.4,
    boundsEast: 127.2,
    boundsWest: 126.8,
  })
  assert.match(sql, /cl\.latitude BETWEEN/)
  assert.match(sql, /cl\.longitude BETWEEN/)
  assert.equal(params[2], 37.4)
  assert.equal(params[3], 37.7)
  assert.equal(params[4], 126.8)
  assert.equal(params[5], 127.2)
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

test('buildCustomerMapUnmappedQuery excludes successful coordinates', () => {
  const { sql, params } = buildCustomerMapUnmappedQuery({
    ...VISIBILITY,
    userId: 'user-1',
    gaId: 3,
    keyword: '김',
  })
  assert.match(sql, /NOT \(/)
  assert.match(sql, /cl\.status = 'success'/)
  assert.match(sql, /map_status/)
  assert.match(sql, /c\.name ILIKE/)
  assert.equal(params[2], '%김%')
})
