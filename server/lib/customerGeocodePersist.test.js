import assert from 'node:assert/strict'
import test from 'node:test'
import {
  geocodeAndPersistCustomerLocation,
  tryGeocodeCustomerOnSave,
} from './customerGeocodePersist.js'

test('geocodeAndPersistCustomerLocation: no address → skipped_no_address', async () => {
  const calls = []
  const executor = {
    async query(sql, params) {
      calls.push({ sql, params })
      return { rowCount: 0, rows: [] }
    },
  }

  const result = await geocodeAndPersistCustomerLocation(executor, {
    customerId: 1,
    userId: 'u1',
    gaId: 2,
    address: '',
  })

  assert.equal(result.outcome, 'skipped_no_address')
  assert.match(calls[0].sql, /skipped_no_address/)
})

test('geocodeAndPersistCustomerLocation: unchanged address with success → skipped_unchanged', async () => {
  const addr = '(06234) 서울특별시 강남구 테헤란로 152'
  const executor = {
    async query() {
      return {
        rowCount: 1,
        rows: [{ status: 'success', address_snapshot: addr }],
      }
    },
  }

  const result = await geocodeAndPersistCustomerLocation(executor, {
    customerId: 1,
    userId: 'u1',
    gaId: 2,
    address: addr,
    previousAddress: addr,
  })

  assert.equal(result.outcome, 'skipped_unchanged')
})

test('geocodeAndPersistCustomerLocation: geocode success persists coordinates', async (t) => {
  const prevNaverId = process.env.NAVER_MAPS_CLIENT_ID
  const prevNaverSecret = process.env.NAVER_MAPS_CLIENT_SECRET
  process.env.NAVER_MAPS_CLIENT_ID = 'test-client-id'
  process.env.NAVER_MAPS_CLIENT_SECRET = 'test-client-secret'
  t.after(() => {
    if (prevNaverId === undefined) delete process.env.NAVER_MAPS_CLIENT_ID
    else process.env.NAVER_MAPS_CLIENT_ID = prevNaverId
    if (prevNaverSecret === undefined) delete process.env.NAVER_MAPS_CLIENT_SECRET
    else process.env.NAVER_MAPS_CLIENT_SECRET = prevNaverSecret
  })

  const calls = []
  const executor = {
    async query(sql, params) {
      calls.push({ sql, params })
      return { rowCount: 0, rows: [] }
    },
  }

  const result = await geocodeAndPersistCustomerLocation(executor, {
    customerId: 9,
    userId: 'u1',
    gaId: 2,
    address: '(06234) 서울특별시 강남구 테헤란로 152',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        addresses: [{ y: '37.5', x: '127.0' }],
      }),
    }),
  })

  assert.equal(result.outcome, 'success')
  assert.ok(calls.some((c) => String(c.sql).includes(`status = 'success'`)))
})

test('tryGeocodeCustomerOnSave swallows executor errors', async () => {
  const executor = {
    async query() {
      throw new Error('db down')
    },
  }

  const result = await tryGeocodeCustomerOnSave(executor, {
    customerId: 1,
    userId: 'u1',
    gaId: 2,
    address: '서울시 중구',
  })

  assert.equal(result.outcome, 'failed')
  assert.equal(result.error, 'geocode_on_save_exception')
})
