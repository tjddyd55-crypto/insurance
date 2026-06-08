import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerMapResponse, mapCustomerMapStatsRow } from './customerMapService.js'

test('buildCustomerMapResponse limits mapCustomers to 20 and reports hiddenByLimit', () => {
  const customers = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `고객${i + 1}`,
    phone: '010',
    address: '서울',
    latitude: 37.5,
    longitude: 127 + i * 0.01,
    lastConsultDate: null,
    isFavorite: false,
  }))

  const payload = buildCustomerMapResponse(customers, {
    statsRow: {
      total_customers: 25,
      with_address: 25,
      without_address: 0,
      geocoded_success: 25,
      geocode_pending: 0,
      geocode_failed: 0,
    },
  })

  assert.equal(payload.mapCustomers.length, 20)
  assert.equal(payload.mapCustomers[0].markerNo, 1)
  assert.equal(payload.mapCustomers[19].markerNo, 20)
  assert.equal(payload.stats.displayedOnMap, 20)
  assert.equal(payload.stats.hiddenByLimit, 5)
  assert.equal(payload.stats.totalCustomers, 25)
  assert.equal(payload.stats.geocodedSuccess, 25)
  assert.equal(payload.map.renderMode, 'dynamic')
  assert.equal(payload.map.markerCount, 20)
  assert.equal(payload.staticMap.imageUrl, null)
  assert.equal(payload.staticMap.imageEndpoint, '/api/customers/map/static-image')
  assert.equal(payload.staticMap.renderMode, 'dynamic')
})

test('mapCustomerMapStatsRow maps legacy fields', () => {
  const stats = mapCustomerMapStatsRow({
    total: 10,
    with_location: 3,
    missing_address: 5,
    geocode_failed: 2,
  })
  assert.equal(stats.totalCustomers, 10)
  assert.equal(stats.geocodedSuccess, 3)
  assert.equal(stats.withoutAddress, 5)
  assert.equal(stats.geocodeFailed, 2)
})
