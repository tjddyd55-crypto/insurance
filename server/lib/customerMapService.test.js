import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomerMapResponse } from './customerMapService.js'

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
    statsRow: { total: 25, with_location: 25, missing_address: 0, geocode_failed: 0 },
  })

  assert.equal(payload.mapCustomers.length, 20)
  assert.equal(payload.mapCustomers[0].markerNo, 1)
  assert.equal(payload.mapCustomers[19].markerNo, 20)
  assert.equal(payload.stats.displayedOnMap, 20)
  assert.equal(payload.stats.hiddenByLimit, 5)
  assert.equal(payload.staticMap.imageUrl, null)
  assert.equal(payload.staticMap.imageEndpoint, '/api/customers/map/static-image')
  assert.equal(payload.staticMap.renderMode, 'static')
})
