import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCustomerMapResponse,
  mapCustomerMapStatsRow,
  parseCustomerMapFilters,
} from './customerMapService.js'
import { CUSTOMER_MAP_DYNAMIC_MAX_MARKERS } from './customerMapRenderConfig.js'

function makeCustomer(id) {
  return {
    id,
    name: `고객${id}`,
    phone: '010',
    address: '서울',
    birthDateYmd: '1990-01-02',
    genderLabel: '남',
    latitude: 37.5 + id * 0.001,
    longitude: 127 + id * 0.001,
    lastConsultDate: null,
    isFavorite: false,
  }
}

test('buildCustomerMapResponse limits dynamic mapCustomers to 100 and reports viewport stats', () => {
  const customers = Array.from({ length: 120 }, (_, i) => makeCustomer(i + 1))

  const payload = buildCustomerMapResponse(customers, {
    boundsApplied: true,
    statsRow: {
      total_customers: 120,
      with_address: 120,
      without_address: 0,
      geocoded_success: 120,
      geocode_pending: 0,
      geocode_failed: 0,
    },
  })

  assert.equal(payload.mapCustomers.length, CUSTOMER_MAP_DYNAMIC_MAX_MARKERS)
  assert.equal(payload.stats.visibleInBounds, 120)
  assert.equal(payload.stats.displayedOnMap, CUSTOMER_MAP_DYNAMIC_MAX_MARKERS)
  assert.equal(payload.stats.hiddenByLimit, 20)
  assert.equal(payload.map.boundsApplied, true)
  assert.equal(payload.map.maxMarkers, CUSTOMER_MAP_DYNAMIC_MAX_MARKERS)
  assert.equal(payload.staticMap.maxMarkerCount, 20)
})

test('buildCustomerMapResponse keeps static map slice at 20', () => {
  const customers = Array.from({ length: 30 }, (_, i) => makeCustomer(i + 1))
  const payload = buildCustomerMapResponse(customers, { statsRow: {} })
  assert.equal(payload.staticMap.markerCount, 20)
})

test('parseCustomerMapFilters reads north/south/east/west bounds', () => {
  const filters = parseCustomerMapFilters({
    north: '37.7',
    south: '37.4',
    east: '127.2',
    west: '126.8',
    zoom: '12',
  })
  assert.equal(filters.boundsApplied, true)
  assert.equal(filters.boundsNorth, 37.7)
  assert.equal(filters.boundsSouth, 37.4)
  assert.equal(filters.boundsEast, 127.2)
  assert.equal(filters.boundsWest, 126.8)
  assert.equal(filters.zoom, 12)
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
  assert.equal(stats.unmappedCount, 7)
})

test('buildCustomerMapResponse includes unmappedCustomers', () => {
  const payload = buildCustomerMapResponse([makeCustomer(1)], {
    statsRow: { total_customers: 2, geocoded_success: 1 },
    unmappedCustomers: [
      {
        id: 2,
        name: '미표시',
        phone: '010',
        address: '',
        birthDateYmd: '',
        genderLabel: '-',
        lastConsultDate: null,
        mapStatus: 'no_address',
        mapStatusLabel: '주소 없음',
      },
    ],
  })
  assert.equal(payload.unmappedCustomers.length, 1)
  assert.equal(payload.mapCustomers[0].birthDateYmd, '1990-01-02')
})
